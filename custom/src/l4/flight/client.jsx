import { createElement, Suspense, use } from 'react'

// ---------------------------------------------------------------------------
// 미니 Flight 프로토콜 (클라이언트 측)
//
// NDJSON 행 스트림을 읽어서 행 id → model 저장소에 넣고,
// model을 다시 React 엘리먼트 트리로 되살린다(revive).
// 아직 도착하지 않은 $lazy 청크는 React 19의 use()로 기다린다 —
// use(promise)는 Suspense와 통합되어 있어, 행이 도착하면 그 자리만 다시 렌더링된다.
// ---------------------------------------------------------------------------

export function createFlightClient(registry) {
  const models = new Map() // id → 도착한 model
  const deferred = new Map() // id → { promise, resolve }

  function ensureDeferred(id) {
    let d = deferred.get(id)
    if (!d) {
      let resolve
      const promise = new Promise((r) => {
        resolve = r
      })
      d = { promise, resolve }
      if (models.has(id)) resolve(models.get(id))
      deferred.set(id, d)
    }
    return d
  }

  function ingest(row) {
    models.set(row.id, row.value)
    ensureDeferred(row.id).resolve(row.value)
  }

  async function connect(url) {
    const res = await fetch(url)
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let index
      while ((index = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, index).trim()
        buffer = buffer.slice(index + 1)
        if (line) ingest(JSON.parse(line))
      }
    }
  }

  // $lazy 슬롯: 자기 자신만의 Suspense 경계를 가져서,
  // 늦게 도착하는 청크가 와도 나머지 트리는 그대로 화면에 남아 있다.
  function LazyRow({ id }) {
    return (
      <Suspense fallback={<div className="skeleton">서버 컴포넌트 청크 스트리밍 중...</div>}>
        <LazyInner id={id} />
      </Suspense>
    )
  }

  function LazyInner({ id }) {
    const model = use(ensureDeferred(id).promise)
    return revive(model)
  }

  function Root() {
    const model = use(ensureDeferred(0).promise)
    return revive(model)
  }

  function revive(model) {
    if (model === null || typeof model !== 'object') return model
    if (Array.isArray(model)) return model.map(revive)
    if (typeof model.$lazy === 'number') return createElement(LazyRow, { id: model.$lazy })
    if (model.$client) {
      const Comp = registry[model.$client]
      if (!Comp) throw new Error(`등록되지 않은 클라이언트 컴포넌트: ${model.$client}`)
      return createElement(Comp, reviveProps(model.props))
    }
    if (model.$element) {
      return createElement(model.$element, reviveProps(model.props))
    }
    if (model.$error) throw new Error(model.$error)
    return model
  }

  function reviveProps(props) {
    const out = {}
    for (const [key, value] of Object.entries(props ?? {})) {
      out[key] = revive(value)
    }
    return out
  }

  return { connect, Root }
}
