# React SSR Lab

React 19로 SSR 렌더러를 가장 기본적인 것부터 심화까지 직접 구현한 학습 프로젝트.
Next.js, Remix(React Router), TanStack Start가 선택한 서로 다른 방향을 최소 구현으로 재현하고 원리를 설명한다.

```
npm install
npm start          # 빌드 + 서버 실행 → http://localhost:3210
npm test           # 빌드 → 서버 기동 → jsdom으로 클라이언트 하이드레이션 검증 (11개 체크)
npm run dev        # esbuild watch (서버는 별도로 npm run serve)
```

## 렌더러 5종 한눈에 보기

| 레벨 | 렌더러 | 핵심 API / 아이디어 | 영감을 준 곳 |
|---|---|---|---|
| [L1](http://localhost:3210/l1) | 기본 SSR | `renderToString` + `hydrateRoot` | 모든 프레임워크의 출발점 |
| [L2](http://localhost:3210/l2) | 스트리밍 SSR | `renderToPipeableStream` + `Suspense` | Next.js App Router, React 18+ SSR |
| [L3](http://localhost:3210/l3) | 라우터 중심 SSR | loader/action, 데이터 직렬화, progressive enhancement | Remix / React Router 7 |
| [L4](http://localhost:3210/l4) | Server Components | 미니 Flight 프로토콜 (컴포넌트 트리 스트리밍) | Next.js App Router (RSC) |
| [L5](http://localhost:3210/l5) | 서버 함수 RPC | 클라이언트 우선 + 서버 함수 호출 | TanStack Start |

렌더링 스펙트럼에서 이 다섯의 위치:

```
CSR(순수 클라이언트)
 → 정적 SSR (HTML 문자열 생성)            … L1
 → 스트리밍 SSR (셸 먼저, 청크 나중에)     … L2
 → SSR + 데이터 프로토콜 (라우터 중심)     … L3
 → 서버 우선 컴포넌트 (컴포넌트가 경계)    … L4  ← Next 방향
 → 클라이언트 우선 + 서버 함수 (함수가 경계) … L5  ← TanStack 방향
```

오른쪽으로 갈수록 "컴포넌트 코드의 어디까지가 서버에서 실행되고, 무엇이 네트워크를 건너는가"에 대한 답이 달라진다.

---

## 배경: SSR은 왜 필요한가

CSR(클라이언트에서만 렌더링)의 문제:

1. 첫 페인트가 느리다 — JS 번들을 받고, 실행하고, 데이터를 fetch하고, 그제야 화면이 그려진다.
2. SEO/공유 미리보기가 취약하다 — 크롤러가 빈 `<div id="root">`를 본다.
3. 초기 데이터 요청이 사용자 기기에서 출발한다 — 서버에서 직접 DB를 읽는 것보다 왕복이 길다.

SSR은 "첫 HTML을 서버에서 만들어 보내는 것"으로 이걸 해결한다. 대신 새 비용이 생긴다:
서버에서 렌더링하는 비용, 서버/클라이언트 코드를 둘 다 관리하는 비용, 그리고 **hydration**(이미 그려진 HTML에 React가 다시 연결되는 과정) 비용.
아래 레벨들은 이 비용을 점점 더 정교하게 줄여가는 역사 그 자체다.

**Hydration이란**: `hydrateRoot`는 DOM을 새로 만들지 않는다. 서버가 보낸 HTML을 그대로 두고,
그 구조를 따라 React 트리를 재구성하면서 이벤트 리스너를 부착한다. 그래서 서버 HTML과 클라이언트 첫 렌더 결과가 다르면
"hydration mismatch"가 발생한다(이 프로젝트의 L1에서 `renderedAt`을 `window.__PROPS__`로 직렬화해 넘기는 이유가 이것이다).

---

## L1 — 기본 SSR: renderToString + hydrateRoot

**서버** (`src/l1/render.server.jsx`)

```jsx
const appHtml = renderToString(<App {...props} />)   // 동기, 문자열 반환
res.end(htmlShell + appHtml + `<script>window.__PROPS__ = ...</script><script src="/static/l1.js"></script>`)
```

**클라이언트** (`src/l1/entry.client.jsx`)

```jsx
hydrateRoot(document.getElementById('root'), <App {...window.__PROPS__} />)
```

원리:

- `renderToString`은 React 트리를 동기적으로 순회하며 HTML 문자열을 만든다. 이 HTML만으로 브라우저는 즉시 페인트한다.
- 클라이언트 번들이 로드되면 `hydrateRoot`가 같은 트리를 렌더링하되, DOM 생성 대신 기존 노드에 이벤트를 건다.
- 서버가 렌더링에 쓴 데이터(props)는 HTML 안에 JSON으로 직렬화되어야 클라이언트가 같은 트리를 재현할 수 있다.

한계(=다음 레벨의 동기):

- **동기 블로킹**: `renderToString`이 끝날 때까지 Node 이벤트 루프가 막히고, 응답 바이트가 하나도 나가지 않는다.
- 페이지 중간에 느린 데이터가 있으면 **전체 응답**이 늦어진다.
- 하이드레이션은 페이지 전체의 컴포넌트 코드를 한 번에 로드/실행한다.

참고로 React 19 기준 `renderToString`보다 `prerender`(Web Streams 기반, 스트리밍)나 `renderToPipeableStream`이 권장된다. `renderToString`은 개념 이해용으로 남았다.

---

## L2 — 스트리밍 SSR: renderToPipeableStream + Suspense

L1의 "다 될 때까지 기다린다"를 "되는 만큼 먼저 보낸다"로 바꾼다.

**서버** (`src/l2/render.server.jsx`)

```jsx
const { pipe } = renderToPipeableStream(<App db={db} />, {
  onShellReady() {           // 셸 준비 즉시 응답 시작
    res.write(chromeTop(...))
    pipe(passthrough)        // 콘텐츠 스트림 → 응답
  },
})
```

**컴포넌트** — 데이터는 Promise, `use()`로 읽는다:

```jsx
function CommentList({ db }) {
  const { comments } = use(db.commentsPromise)  // pending이면 suspend → fallback 송출
  return ...
}
```

동작 순서(실측 타이밍, `npm start` 후 L2 페이지의 Network 탭에서 재현 가능):

1. **~35ms** — 셸 도착: 레이아웃 + `<Suspense fallback>` 자리의 스켈레톤. 각 경계는 `<!--$?--><template id="B:0"></template>` 표식으로 위치만 남긴다.
2. **~400ms** — 포스트 데이터 해결 → React가 `<div hidden id="S:0">` 안에 실제 콘텐츠를 담은 청크를 플러시. 함께 온 `<script>$RC("B:0","S:0")</script>`가 fallback을 실제 콘텐츠로 교체.
3. **~2.5s** — 댓글 청크 도착, 같은 방식으로 교체. 그제서야 응답 종료.

핵심 메커니즘:

- **Suspense는 서버에서도 동작한다.** 컴포넌트가 Promise를 던지면(여기선 `use()`가 처리) React는 그 경계를 fallback으로 렌더링해 먼저 내보내고, Promise 해결 시 청크를 추가로 플러시한다.
- **Out-of-order 스트리밍**: 청크는 문서 순서와 무관하게 도착하고, inline script가 DOM 제자리로 끼워넣는다. 순수 HTML+script라서 **클라이언트 JS 없이도** 완성된 페이지가 된다.
- **`onShellReady` vs `onAllReady`**: 셸만 준비되면 보낼지(사람용), 전부 준비되고 보낼지(크롤러/사전 렌더링용).
- **데이터 재사용**: 서버가 HTML 꼬리에 `window.__DATA__`를 직렬화하면, 클라이언트는 그걸로 *이미 이행된 Promise*를 만들어 `use()`에 준다. 하이드레이션이 서버 HTML과 일치하고, 데이터를 다시 fetch하지 않는다. (실제 프레임워크는 이를 청크 단위로 더 정교하게 한다)
- Edge/fetch 기반 런타임(Cloudflare Workers, Deno Deploy 등)에는 같은 개념의 `renderToReadableStream`(Web Streams)을 쓴다.

한계: HTML이 빨라졌을 뿐, **클라이언트 번들 크기와 하이드레이션 범위는 그대로**다. 보여주기만 하는 콘텐츠도 컴포넌트 코드가 전부 JS로 내려간다. 이 문제를 정면으로 푸는 것이 RSC다.

---

## L3 — Remix 스타일: 라우터가 중심 (loader/action)

Remix(현 React Router 7 프레임워크 모드)의 모델: 서버/클라이언트의 경계를 **컴포넌트가 아니라 라우트**로 정의한다.

구성(`src/l3/`):

- `routes.jsx` — 라우트 테이블. 각 라우트는 `{ path, Layout, layoutLoader, Component, loader, action? }`.
- `router.js` — `:param` 매칭 + **layoutLoader와 loader를 `Promise.all`로 병렬 실행**(데이터 워터폴 제거).
- `render.server.jsx` — 요청 처리 분기:

```
GET  /l3/mail/2          → loader 실행 → HTML + window.__PAYLOAD__ 직렬화
GET  /l3/mail/2?_data=1  → loader 실행 → JSON만 반환 (클라이언트 내비게이션용)
POST /l3/mail/2          → action 실행 → 303 redirect (JS 없는 브라우저)
POST /l3/mail/2?_data=1  → action 실행 → 새 payload JSON (JS 있는 브라우저)
```

원리:

- **loader**는 렌더링 전에 서버에서 데이터를 준비한다. 매칭된 중첩 라우트의 로더는 전부 병렬로 돈다.
- **action**은 HTML `<form method="post">`로 호출되는 mutation이다. 이게 Remix 철학의 핵심인데,
  form submission은 JS 없이도 동작하는 웹 표준이므로 **progressive enhancement**가 기본값이 된다.
  JS가 있으면(여기선 `onSubmit`에서 `preventDefault` 후 fetch) 폼 제출을 가로채 JSON으로 처리하고, 없으면 브라우저가 그대로 POST → redirect를 따른다.
- 하이드레이션 이후에는 SPA: 링크 클릭 → `?_data` fetch → `setState`로 화면 교체(`history.pushState` 포함). **초기 로드는 웹 표준, 이후는 SPA**라는 이중 구조.
- 서버 상태(여기선 메모리의 메일함)가 action으로 바뀌고 다음 loader 실행에서 반영된다 — "UI는 서버 상태의 함수"라는 관점.

실제 Remix/React Router와의 차이: 이 데모는 라우트 매칭과 중첩을 단순화했고(레이아웃 1단계), 실제 React Router 7은 `turbo-stream` 기반 single-fetch로 직렬화를 더 효율화했다.

---

## L4 — Server Components: Next가 선택한 방향

**발상 전환**: 서버가 HTML을 보내는 게 아니라 **컴포넌트 트리 자체**를 보낸다.
서버 컴포넌트는 서버에서 실행되고 그 결과가 스트리밍되며, 클라이언트 컴포넌트만 JS 번들에 남는다.

### 미니 Flight 프로토콜 (`src/l4/flight/`)

React의 실제 RSC wire 포맷("React Flight")을 단순화해 NDJSON 행으로 구현했다. `/l4/flight` 응답 예:

```jsonc
{"id":0,"value":{"$element":"div","props":{"children":[
    {"$element":"div","props":{"className":"card","children":[
        {"$element":"h2","props":{"children":"헤더 ..."}},
        ...,
        {"$client":"Counter","props":{}}     // 클라이언트 컴포넌트 참조
    ]}},
    {"$lazy":1}, {"$lazy":2}                 // 아직 스트리밍 중인 청크
]}}}
{"id":1,"value":{...포스트 목록...}}          // ~1.2초 후 도착
{"id":2,"value":{...팀 현황...}}              // ~2.4초 후 도착
```

- `$element` — 서버에서 렌더링된 호스트 엘리먼트. 재조립 규칙만 알면 된다.
- `$client` — 클라이언트 컴포넌트 **참조**(이름 + 직렬화된 props). 서버는 이 컴포넌트를 실행하지 않는다.
- `$lazy` — 같은 `id`를 가진 행이 나중에 도착하는 스트리밍 슬롯. 클라이언트는 React 19의 `use(promise)`로 기다린다.

**서버 측 직렬화기**(`flight/server.js`)는 엘리먼트 트리를 순회하며:

- 서버 컴포넌트(함수)는 그 자리에서 호출한다. async면(데이터 fetch 중) `$lazy` 참조를 먼저 보내고, 이행되면 해당 id의 행을 추가 플러시한다 → RSC 스트리밍.
- 클라이언트 컴포넌트는 실행하지 않고 참조만 기록한다.
- **함수는 직렬화 불가** — 이벤트 핸들러를 props로 넘기려 하면 직렬화기가 throw한다. 이게 RSC의 직렬화 경계가 강제하는 제약이다.

**클라이언트 측**(`flight/client.jsx`)은 행을 파싱해 저장하고, model을 React 엘리먼트로 되살린다(revive).
`$lazy` 슬롯은 각자 `<Suspense>` 경계를 가지므로 늦게 도착하는 청크를 기다리는 동안 나머지는 계속 보인다 — L2의 스트리밍 UX가 컴포넌트 트리 수준에서 재현된다.

### 이게 실제로 의미하는 것

- **서버 컴포넌트는 JS 0바이트**: 포스트 목록, 팀 현황 같은 순수 표시용 컴포넌트 코드는 번들에 아예 없다(`src/l4/server-components.jsx`는 클라이언트 엔트리가 import하지 않아 esbuild가 제외한다).
- **데이터 접근이 컴포넌트 안으로**: `async function PostFeed()`가 DB를 직접 읽고 렌더링한다. API 계층/클라이언트 캐시가 필요 없다.
- **경계의 단위가 컴포넌트**: `'use client'` 한 줄이 서버/클라이언트를 가른다. 이 데모에서는 `clientRef(name, props)`가 그 역할을 한다.

### 실제 Next.js와 다른 점(단순화 목록)

- Next는 flight 스트림을 초기 HTML에 `<script>` 행으로 심어서 JS 없이도 표시하고 하이드레이션한다. 데모는 JS 부팅 후 fetch.
- Next는 번들러 플러그인으로 `'use client'` 모듈을 모듈 URL 참조로 바꿔 lazy 로드한다. 데모는 이름 문자열 레지스트리.
- Next는 flight 재요청으로 트리를 갱신하면서 클라이언트 상태를 유지한다(reconciliation). 데모는 초기 스트림만.
- Next는 `fetch` 캐시/태그 재검증, Partial Prerendering(정적 셸 + 동적 슬롯) 같은 캐싱 계층이 있다.

---

## L5 — 서버 함수: TanStack Start가 선택한 방향

L4와 정반대 방향. **컴포넌트는 전부 클라이언트 것이며, 서버는 함수만 노출한다.**

```
L4(Next): 서버가 컴포넌트를 실행 → 실행 결과(트리)가 네트워크를 건넘
L5(TanStack): 클라이언트가 함수를 호출 → 인자/반환값만 네트워크를 건넘
```

구성(`src/l5/`):

- `server/functions.js` — 서버 번들에만 존재하는 함수들(`listTodos`, `addTodo`, `toggleTodo`, `removeTodo`). 서버 메모리의 todo 저장소를 조작한다.
- `render.server.jsx`의 `POST /l5/__rpc` — RPC 엔드포인트. `{ name, args }`를 받아 등록된 함수를 실행하고 결과를 JSON으로 반환:

```js
const fn = serverFunctions[name]      // 서버 함수 레지스트리
const result = await fn(args ?? {})   // 인자가 경계를 건너고, 결과도 직렬화되어 돌아온다
```

- 클라이언트는 `callServerFn('addTodo', { text })`처럼 이름으로 호출할 뿐, 함수 구현을 번들에 싣지 않는다.
- **SSR은 옵션**: 첫 요청에서만 서버가 `listTodos()`를 직접 호출해 HTML을 만들어 준다(여기선 `renderToString`). 하이드레이션 이후의 모든 상태는 클라이언트가 소유하고, 서버는 렌더링에 관여하지 않는다.
- **Progressive enhancement 겸비**: 추가 폼은 실제 `<form method="post" action="/l5/add">`라서 JS가 없어도 POST → redirect로 동작한다. JS가 있으면 RPC로 대체된다. L3의 웹 표준 철학과도 통하는 부분.

실제 TanStack Start는 여기서 더 나아가:

- `createServerFn()`으로 타입이 보존되는 서버 함수를 만든다(클라이언트에서 호출 시 인자/반환 타입이 자동 전파).
- TanStack Router의 타입 안전 라우팅 + loader와 결합하고, RSC 지원도 옵션으로 제공한다.
- 핵심 정체성은 변하지 않는다: **클라이언트 라우터가 진실의 원천이고, 서버는 타입 안전한 백엔드 API**.

---

## L4 vs L5: 두 프레임워크가 갈라선 지점

| 질문 | L4 / Next (RSC) | L5 / TanStack Start (서버 함수) |
|---|---|---|
| 무엇이 네트워크를 건너나 | 컴포넌트 실행 결과(직렬화된 트리) | 함수 인자와 반환값 |
| 경계의 단위 | 컴포넌트 (`'use client'`) | 함수 (`createServerFn`) |
| 컴포넌트 코드의 거처 | 서버 기본, 클라이언트는 예외 | 전부 클라이언트 |
| 초기 JS | 표시용 컴포넌트 0바이트 | 전체 앱 번들 |
| 상태 소유 | 서버가 트리를 다시 렌더링해 스트리밍 | 클라이언트 상태/캐시 |
| SSR의 지위 | 아키텍처의 중심 | SPA를 돕는 옵션 |
| 상호작용 구현 | 클라이언트 컴포넌트 + Server Actions | 서버 함수 RPC |
| 대가 | 프로토콜 복잡도, 새로운 멘탈 모델 | 번들 크기 (CSR과 동일) |

세 프레임워크 요약:

| | Next.js (App Router) | Remix / React Router 7 | TanStack Start |
|---|---|---|---|
| 철학 | 서버 우선 | 웹 표준 우선, 점진적 향상 | 클라이언트 우선, 타입 안전 |
| 첫 응답 | HTML + 내장 flight 페이로드 | HTML + 직렬화된 loader 데이터 | HTML + dehydrate된 라우터 상태 |
| 데이터 로딩 | async 서버 컴포넌트, 캐시 | loader(병렬, prefetch) | loader + 서버 함수 |
| mutation | Server Actions | action(form POST) | 서버 함수 RPC |
| 스트리밍 | RSC 스트리밍 + Suspense | single-fetch 스트리밍 | SSR 스트리밍 지원 |

---

## 이 프로젝트에서 쓴 React 19 기능

- `renderToString`, `renderToPipeableStream`(`onShellReady`/`onShellError`/`onError`) — 서버 렌더러 2종.
- `hydrateRoot` — 하이드레이션. React 19에서도 SSR 앱의 클라이언트 진입점은 그대로 `hydrateRoot`다.
- `use(promise)` — Promise를 렌더 중에 읽는 훅. L2에서는 서버 스트리밍과 클라이언트 하이드레이션을 같은 코드로 연결하고, L4에서는 flight 행 도착을 Suspense로 기다리는 데 썼다.
- Server Components와의 관계: 실제 RSC는 별도 번들 조건(`react-server`)에서 동작하는 별개의 React 서브셋이다. 이 데모는 그 wire 포맷과 스트리밍 의미를 일반 React로 재현한 것이다.

## 의도적으로 생략한 것

- 인증/인가, 에러 바운더리 세부 동작, 캐싱/재검증
- selective hydration 우선순위 데모(React는 클릭된 경계를 우선 하이드레이션한다 — 구조는 L2에 있고 동작은 프로파일러 영역)
- 실제 번들러 플러그인 기반 모듈 참조(RSC), HMR
- `renderToReadableStream`(edge) — L2와 개념 동일, 스트림 타입만 다름

## 파일 구조

```
build.mjs                  esbuild 빌드 (서버 1 + 클라이언트 번들 5)
scripts/client-check.mjs   jsdom으로 실제 번들의 하이드레이션/인터랙션 검증
scripts/test.mjs           빌드 → 서버 → 검증 전체 파이프라인 (npm test)
src/server.jsx             공용 HTTP 서버 + 정적 번들 서빙
src/shared/                HTML 크롬(스타일/nav), JSON 직렬화 헬퍼
src/home/                  허브 페이지
src/l1/                    기본 SSR
src/l2/                    스트리밍 SSR
src/l3/                    Remix 스타일 라우터 + loader/action
src/l4/flight/             미니 Flight 프로토콜 (server.js: 직렬화, client.jsx: 조립)
src/l5/                    서버 함수 RPC
```

## 참고

- React 문서: [Streaming SSR](https://react.dev/reference/react-dom/server/renderToPipeableStream), [`use`](https://react.dev/reference/react/use), [hydrateRoot](https://react.dev/reference/react-dom/client/hydrateRoot)
- React 19 워킹 그룹의 RSC 데모: [react-server-dom-* 패키지](https://www.npmjs.com/package/react-server-dom-webpack) (실제 Flight 구현)
- Next.js: [Server Components 개요](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- Remix/React Router: [Data loading](https://remix.run/docs/en/main/start/tutorial#loading-data), React Router 7 framework mode
- TanStack Start: [Server Functions](https://tanstack.com/start/latest/docs)
