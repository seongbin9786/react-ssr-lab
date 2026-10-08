import { isValidElement, Fragment } from 'react'

// ---------------------------------------------------------------------------
// 미니 Flight 프로토콜 (서버 측 직렬화기)
//
// React Server Components가 실제로 하는 일을 단순화한 버전.
// 서버에서 React 엘리먼트 트리를 "실행"해서, 클라이언트가 다시 조립할 수 있는
// JSON 행(NDJSON) 스트림으로 만든다.
//
// 행 포맷:
//   { "id": 0, "value": <model> }        ← 루트 또는 지연 청크의 해결 결과
//
// model 안에서 쓰이는 마커:
//   { $element: 'div', props }   서버에서 렌더링된 호스트 엘리먼트
//   { $client: 'LikeButton', props }  클라이언트 컴포넌트 참조 (JS가 필요한 부분)
//   { $lazy: <id> }              아직 스트리밍 중인 값 (같은 id의 행이 나중에 도착)
// ---------------------------------------------------------------------------

export const CLIENT_REF = Symbol.for('ssr-lab.client-ref')

// 서버 컴포넌트가 클라이언트 컴포넌트를 참조할 때 쓰는 헬퍼
export function clientRef(name, props = {}) {
  return { $$typeof: CLIENT_REF, name, props }
}

export function renderFlightToStream(element, { write, close }) {
  let nextId = 1
  let pending = 0
  let finished = false

  const emit = (row) => write(JSON.stringify(row) + '\n')

  function maybeFinish() {
    if (pending === 0 && !finished) {
      finished = true
      close()
    }
  }

  function resolveAsync(id, promise) {
    pending++
    promise
      // 이행된 값의 직렬화(resolveModel)도 throw할 수 있다(예: props에 함수).
      // 같은 then의 두 번째 인자는 첫 번째 콜백의 throw를 잡지 못하므로,
      // 직렬화를 앞 단계 then으로 분리해 그 에러도 $error 행으로 내려보낸다.
      .then((value) => resolveModel(value))
      .then(
        (model) => emit({ id, value: model }),
        (error) => emit({ id, value: { $error: String(error?.message ?? error) } })
      )
      .finally(() => {
        pending--
        maybeFinish()
      })
  }

  function resolveModel(value) {
    if (value === undefined || value === null) return null
    const type = typeof value
    if (type === 'string' || type === 'number' || type === 'boolean') return value
    if (type === 'function') {
      throw new Error('함수는 서버 → 클라이언트 경계를 건널 수 없다 (직렬화 불가)')
    }
    if (Array.isArray(value)) return value.map(resolveModel)
    if (value.$$typeof === CLIENT_REF) {
      // 클라이언트 컴포넌트 참조: 실행하지 않고 참조만 직렬화
      return { $client: value.name, props: resolveProps(value.props) }
    }
    if (isValidElement(value)) return resolveElement(value)
    if (typeof value.then === 'function') {
      // Promise = 아직 준비되지 않은 청크 → $lazy 참조를 먼저 보내고,
      // 이행되면 그 id로 새 행을 스트리밍한다.
      const id = nextId++
      resolveAsync(id, value)
      return { $lazy: id }
    }
    const out = {}
    for (const [key, v] of Object.entries(value)) out[key] = resolveModel(v)
    return out
  }

  function resolveElement(element) {
    const { type, props } = element
    if (type === Fragment) return resolveModel(props.children)
    if (typeof type === 'string') {
      return { $element: type, props: resolveProps(props) }
    }
    if (typeof type === 'object' && type !== null && type.$$typeof === CLIENT_REF) {
      // 클라이언트 컴포넌트는 실행하지 않는다. "참조"만 직렬화한다.
      return { $client: type.name, props: resolveProps(type.props) }
    }
    if (typeof type === 'function') {
      // 서버 컴포넌트: 여기서 실행해버린다. async면 $lazy가 된다.
      return resolveModel(type(props))
    }
    throw new Error(`직렬화할 수 없는 엘리먼트 타입: ${String(type)}`)
  }

  function resolveProps(props) {
    const out = {}
    for (const [key, value] of Object.entries(props)) {
      if (key === 'children') {
        out.children = resolveModel(value)
        continue
      }
      if (typeof value === 'function') {
        throw new Error(`클라이언트 컴포넌트 props로 함수를 전달할 수 없다: ${key}`)
      }
      out[key] = resolveModel(value)
    }
    return out
  }

  emit({ id: 0, value: resolveModel(element) })
  maybeFinish()
}
