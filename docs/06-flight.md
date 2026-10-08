# 06 — Flight: 컴포넌트 트리가 네트워크를 건너는 법

03편까지의 SSR이 보내는 것은 **HTML**이다 — 브라우저의 페인트 엔진이 소비하는 결과물. RSC(React Server Components)는 질문을 바꾼다: 받는 쪽을 브라우저가 아니라 **클라이언트의 React 런타임**으로 바꾸면, 보내야 하는 것도 HTML이 아니라 **렌더링된 트리 자체**여야 하지 않을까?

그 트리를 직렬화해서 스트리밍하는 프로토콜이 **Flight**다. Next.js App Router의 페이지 소스에서 보이는 `self.__next_f.push(...)` 스크립트들이 전부 Flight 페이로드다. 이 글은 이 레포 L4의 미니 Flight 구현(`custom/src/l4/flight/`)을 뜯어보며, 직렬화기가 트리를 어떻게 행(rows)으로 바꾸고, 클라이언트는 그걸 어떻게 다시 트리로 되살리는지를 설명한다.

---

## 1. 네트워크를 건너는 것이 바뀐다

벤치마크 글들([benchmarks.md](benchmarks.md)의 Josh Comeau, Vercel)의 핵심 명제를 한 표로 정리하면:

| | 무엇을 보내나 | 받는 쪽 | 경계의 단위 |
|---|---|---|---|
| SSR (01~03편) | 컴포넌트 실행 결과의 **HTML 표현** | 브라우저 페인트 엔진 | 페이지/청크 |
| Flight/RSC | 컴포넌트 실행 결과의 **직렬화된 트리** | 클라이언트 React 런타임 | 컴포넌트 (`'use client'`) |

이 차이가 만든 결과들:

- **서버 컴포넌트의 JS는 0바이트.** 실행 결과가 건너므로 코드는 건널 필요가 없다. L4에서 포스트 목록·팀 현황 컴포넌트 코드는 클라이언트 번들에 존재하지 않는다(클라이언트 엔트리가 import하지 않아 esbuild가 제외).
- **데이터가 트리 안에 있다.** HTML의 텍스트로 녹아든 게 아니라 구조화된 값으로 건너므로, 클라이언트 React가 그 위에 다시 렌더링할 수 있다.
- **클라이언트 컴포넌트는 참조만 건넌다.** "이건 브라우저에서 실행할 컴포넌트다"라는 표식 + props만.

## 2. 직렬화기: 서버 컴포넌트는 직렬화 중에 실행된다

L4의 서버 직렬화기([`flight/server.js`](../custom/src/l4/flight/server.js))의 핵심은 `resolveModel` — 값을 받아 "건널 수 있는 형태"로 바꾸는 규칙 집합이다:

```js
function resolveModel(value) {
  if (value === undefined || value === null) return null
  const type = typeof value
  if (type === 'string' || type === 'number' || type === 'boolean') return value
  if (type === 'function') {
    throw new Error('함수는 서버 → 클라이언트 경계를 건널 수 없다 (직렬화 불가)')
  }
  if (Array.isArray(value)) return value.map(resolveModel)
  if (value.$$typeof === CLIENT_REF) {
    return { $client: value.name, props: resolveProps(value.props) }   // 실행 안 함, 참조만
  }
  if (isValidElement(value)) return resolveElement(value)
  if (typeof value.then === 'function') {
    const id = nextId++
    resolveAsync(id, value)          // 이행되면 그 id로 새 행을 플러시
    return { $lazy: id }             // 지금은 슬롯 번호만
  }
  const out = {}
  for (const [key, v] of Object.entries(value)) out[key] = resolveModel(v)
  return out
}
```

그리고 엘리먼트를 만났을 때(`resolveElement`)가 진짜 분기점이다:

```js
function resolveElement(element) {
  const { type, props } = element
  if (type === Fragment) return resolveModel(props.children)
  if (typeof type === 'string') {
    return { $element: type, props: resolveProps(props) }        // 호스트 태그
  }
  if (typeof type === 'object' && type.$$typeof === CLIENT_REF) {
    return { $client: type.name, props: resolveProps(type.props) } // 클라이언트 컴포넌트: 참조
  }
  if (typeof type === 'function') {
    return resolveModel(type(props))                              // 서버 컴포넌트: 지금 실행
  }
}
```

세 종류의 컴포넌트 처리가 한눈에 갈린다:

1. **호스트 엘리먼트**(`'div'` 등): 태그 + 직렬화된 props로 기록.
2. **클라이언트 컴포넌트**: **실행하지 않는다.** 이름과 props(직렬화된)만 기록한 참조. 실행은 브라우저의 몫이다.
3. **서버 컴포넌트**(함수): **그 자리에서 호출한다.** 반환값이 다시 `resolveModel`을 거친다. 만약 `async` 컴포넌트라면 반환값이 Promise이고, 위 규칙에 따라 `$lazy` 슬롯이 나간다 — **async 서버 컴포넌트가 자동으로 스트리밍 청크가 되는 메커니즘**이 이 세 줄이다. (05편의 서버 Suspense와 같은 원리: 기다림 = 나중에 행 추가.)

`resolveProps`에는 직렬화 경계의 강제 규칙이 있다 — **props로 함수를 넘기면 throw**. 이벤트 핸들러를 서버 컴포넌트에서 만들어 클라이언트 컴포넌트에 주입할 수 없다는 뜻이고, 그래서 상호작용 로직은 반드시 클라이언트 컴포넌트 안에 살아야 한다. RSC의 경계가 "권장"이 아니라 물리적으로 강제되는 지점이다.

## 3. 실측: 스트림의 실제 모양

`/l4/flight` 응답(React는 관여하지 않고, L4 직렬화기가 직접 만든 NDJSON):

```jsonc
// 1행 (즉시) — 루트. 아직 안 온 청크는 $lazy 슬롯이다
{"id":0,"value":{"$element":"div","props":{"children":[
    {"$element":"div","props":{"className":"card","children":[
        {"$element":"h2","props":{"children":"헤더 (동기 서버 컴포넌트 — 즉시 도착)"}},
        {"$element":"p","props":{...}},
        {"$client":"Counter","props":{}}        // ← 클라이언트 컴포넌트 참조
    ]}},
    {"$lazy":1},                                 // ← 포스트 목록 (1.2초 후 도착)
    {"$lazy":2}                                  // ← 팀 현황 (2.4초 후 도착)
]}}}

// 2행 (~1.2초) — async 서버 컴포넌트 PostFeed의 실행 결과
{"id":1,"value":{"$element":"div","props":{"className":"card","children":[...]}}}

// 3행 (~2.4초) — async 서버 컴포넌트 TeamStats의 실행 결과
{"id":2,"value":{"$element":"div","props":{...}}}
```

03편의 스트리밍 SSR과 형태가 정확히 대응한다: 03편에서는 **늦은 HTML + `$RC` 스크립트**가 스트림 뒤에 붙었다면, 여기서는 **늦은 모델 행**이 붙는다. "되는 만큼 먼저 보내고, 늦는 건 나중에 제자리로"라는 설계가 계층만 바꿔 반복된다.

## 4. 부활(revive): 행들을 다시 트리로

클라이언트([`flight/client.jsx`](../custom/src/l4/flight/client.jsx))는 세 가지를 한다.

**(a) 행을 수집한다.** fetch의 ReadableStream을 읽어서 줄 단위로 파싱, `id → model` 저장소에 넣고, 그 id를 기다리는 deferred Promise를 이행시킨다:

```js
async function connect(url) {
  const reader = (await fetch(url)).body.getReader()
  // ... 줄 단위로 잘라서
  ingest(JSON.parse(line))   // models.set(row.id, row.value); deferred.resolve
}
```

**(b) `$lazy` 슬롯을 Suspense 경계로 만든다.** 각 슬롯은 자기 Promise를 `use()`로 기다리는 컴포넌트가 된다 — 05편의 메커니즘이 여기서 재사용된다:

```jsx
function LazyRow({ id }) {
  return (
    <Suspense fallback={<div className="skeleton">서버 컴포넌트 청크 스트리밍 중...</div>}>
      <LazyInner id={id} />
    </Suspense>
  )
}
function LazyInner({ id }) {
  const model = use(ensureDeferred(id).promise)   // 행이 도착하면 여기서 깨어난다
  return revive(model)
}
```

**(c) model을 React 엘리먼트로 되살린다.** 직렬화기의 규칙을 역순으로:

```js
function revive(model) {
  if (typeof model.$lazy === 'number') return createElement(LazyRow, { id: model.$lazy })
  if (model.$client) {
    const Comp = registry[model.$client]          // 이름 → 실제 컴포넌트 함수
    return createElement(Comp, reviveProps(model.props))
  }
  if (model.$element) return createElement(model.$element, reviveProps(model.props))
  return model                                     // 원시값
}
```

`$client` 참조가 **실제 코드**와 만나는 유일한 장소가 `registry`다. 서버가 보낸 것은 이름뿐이고, 그 이름에 해당하는 구현은 클라이언트 번들에 이미 있어야 한다 — "클라이언트 컴포넌트의 코드는 번들에 남는다"는 말의 실체.

결과적으로 flight 스트림은 **React 엘리먼트 트리가 자라나는 과정**이 된다: 루트 행이 도착하면 헤더가 렌더되고, 1.2초에 1행이 도착하면 포스트 목록 경계가 깨어나고, 2.4초에 2행이 도착하면 팀 현황이 채워진다. 이 최종 트리를 렌더링하는 것은 02~04편의 그 reconciler(`createRoot`)이다. Flight는 새 렌더러가 아니라 **reconciler에 들어갈 입력을 네트워크 건너편에서 만들어 주는 프로토콜**이다.

## 5. 실제 React Flight와의 대응

L4는 프로토콜의 뼈대를 재현한 것이다. 실제 `react-server-dom-*` 패키지의 wire 포맷과 대응시키면:

| L4 미니 포맷 | 실제 Flight 포맷 |
|---|---|
| `{"id":0,"value":...}` 행 | `0:<model>` 행 (id + 직렬화 모델) |
| `{"$element":"div",props}` | `["$","div",null,{props}]` 튜플 |
| `{"$client":"Counter"}` | `$L<hex>` — 번들러가 해석하는 **모듈 참조** |
| `{"$lazy":1}` | `$@1` — 1번 행(또는 그 Promise)을 기다리는 참조 |
| `clientRef(name)` + 이름 레지스트리 | `'use client'` 지시어 + 번들러 플러그인이 만드는 모듈 URL 참조 |
| 데모: JS 부팅 후 fetch | Next: flight 행을 초기 HTML에 `<script>self.__next_f.push([1,"..."])</script>`로 내장 |

실제 포맷에서 특히 중요한 차이는 두 가지다:

**클라이언트 컴포넌트가 이름이 아니라 모듈 참조다.** `'use client'`가 붙은 모듈은 빌드 시 "이 모듈의 브라우저 번들에서의 주소"를 가리키는 참조로 변환된다. 서버는 그 참조를 직렬화하고, 클라이언트는 참조를 보고 해당 모듈을 (lazy로) 로드한다. L4의 레지스트리는 이 모듈 시스템을 이름표 하나로 단순화한 것이다.

**flight 페이로드가 HTML 안에 내장된다.** Next는 서버에서 flight 페이로드를 만들면서, 동시에 그 페이로드로부터 SSR HTML을 생성해 보내고, 페이로드 자체는 `self.__next_f.push(...)` 스크립트 행으로 HTML 안에 심는다. 그러면 클라이언트 React는 **추가 요청 없이** 같은 페이로드를 읽어 트리를 재구성하고, 이미 그려진 HTML에 대해 하이드레이션한다(04편). HTML(페인트용)과 flight(React용)가 한 응답에 같이 실리는 것이다.

## 6. 조립 규칙이 만드는 제약과 가능성

이 프로토콜의 규칙들에서 실무 제약과 가능성이 그대로 파생된다:

**제약:**
- 함수는 경계를 건너지 못한다 → 이벤트 핸들러는 클라이언트 컴포넌트 안에서. 서버 컴포넌트가 클라이언트 컴포넌트에 `onClick` prop을 줄 수 없다.
- 직렬화 가능한 값만 props로 → Date, Map, Set 등도 제한적으로만(실제 Flight는 일부 특수 타입을 지원하지만 임의 객체는 불가).
- 서버 컴포넌트는 state/effect 불가 → 실행이 한 번이고(05편 2절), 결과만 건너므로.

**가능성:**
- **children으로 끼워넣기(interleaving)**: 서버 컴포넌트가 클라이언트 컴포넌트를 감쌀 때, 그 `children`은 이미 서버에서 렌더된 직렬화 트리다. 클라이언트 컴포넌트는 자기가 감싼 children이 서버산인지 모르고 그대로 렌더한다 — 서버 트리와 클라이언트 트리가 하나의 트리에서 교차할 수 있는 이유.
- **트리 갱신**: flight 스트림을 다시 요청하면 새 모델 행들이 오고, 클라이언트 reconciler는 기존 상태(입력값, 스크롤 등)를 유지하며 트리를 교체한다. 서버가 UI 갱신에 개입할 수 있는 통로 — Server Actions의 응답이 flight 스트림인 이유다.
- **번들 다이어트**: 표시용 컴포넌트를 서버 컴포넌트로 두는 한, 앱이 커져도 클라이언트 번들은 상호작용 컴포넌트만큼만 자란다.

## 7. 시리즈 마무리: 한 장으로 보는 전체 파이프라인

01~06편을 한 요청의 시간선으로 잇는다:

```
[서버]
 엘리먼트 트리
   ├─ Fizz 렌더링 (03) ──▶ HTML 셸 + <!--$?--> 경계 + hidden 청크 + $RC 스크립트
   │                         └─ (RSC라면) flight 행도 HTML에 내장 (06)
   └─ 직렬화 데이터 (01: window.__PROPS__/__DATA__)

[브라우저]
 HTML 페인트 (JS 없이 완성 — 03)
   ↓ 번들 로드
 hydrateRoot (04)
   ├─ DOM 클레임 + diff, 이벤트 위임, lanes 기반 selective hydration
   ├─ use(): 직렬화 데이터 → (이미 이행된) thenable → 동기 읽기 (05)
   └─ (RSC라면) flight 행 → revive → 엘리먼트 트리 → reconciler 입력 (06)
   ↓
 완전한 인터랙티브 앱 — 이후의 갱신은 평범한 Fiber reconciliation (02)
```

각 편이 설명한 것은 결국 하나의 질문에 대한 답이었다: **"네트워크를 건너는 것은 무엇이고, 받는 쪽은 그것을 어떻게 다시 앱으로 만드는가."** 01편에서는 HTML 문자열과 props JSON이었고, 03편에서는 지연 청크와 명령 스크립트였고, 06편에서는 직렬화된 트리 그 자체였다. Fiber(02)는 그 모든 것의 수신 측 인프라였고, Suspense/use(05)는 송수신 양쪽의 공통 언어였다.
