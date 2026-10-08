# 01 — renderToString은 어떻게 동작하는가

```jsx
// custom/src/l1/render.server.jsx
const appHtml = renderToString(<App {...props} />)
res.end(chromeTop() + appHtml + chromeBottom())
```

함수 한 번 호출했더니 HTML 문자열이 나왔다. 이 한 줄 안에서 React는 무슨 일을 하는 걸까.
이 글은 그 내부 — 엘리먼트 트리 순회, 서버 환경의 훅, 문자열 직렬화 — 를 순서대로 뜯어본다.

---

## 1. 입력은 컴포넌트가 아니라 엘리먼트 트리다

`<App {...props} />`는 JSX 변환 후 `createElement(App, props)`의 결과, 즉 **React 엘리먼트**라는 평범한 객체다:

```js
{
  type: App,                    // 함수 컴포넌트 자체에 대한 참조
  props: { renderedAt: '...', renderedBy: '...' },
  key: null,
  ref: null,
}
```

중요한 점: 이 시점에 `App` 함수는 **아직 실행되지 않았다**. 엘리먼트는 "이걸 그려달라"는 기술(description)이지 실행 결과가 아니다.
함수를 즉시 호출하는 대신 엘리먼트로 감싸는 이유를 React 팀은 이렇게 설명한다 — 호출 시점과 횟수를 React가 결정할 수 있어야 렌더링을 중단하고, 재개하고, 건너뛸 수 있다(제어의 역전).

`renderToString`은 이 루트 엘리먼트를 받아 **깊이 우선으로** 트리를 순회한다. 순회 중 만나는 엘리먼트의 `type`에 따라 하는 일이 갈린다:

| type | 렌더러가 하는 일 |
|---|---|
| 함수 컴포넌트 | 함수를 호출(props 전달) → 반환된 엘리먼트로 순회 계속 |
| `'div'`, `'section'` 같은 문자열 | 여는 태그 문자열 생성 → children 순회 → 닫는 태그 |
| `Fragment` | 태그 없이 children만 순회 |
| `Suspense` | fallback을 즉시 렌더링 (renderToString은 기다려주지 않는다) |

L1의 [`App.jsx`](../custom/src/l1/App.jsx)를 대입하면 순서는 대략 이렇다:

```
<App> 호출
 └─ <section>  → "<section>"
     └─ <h1>   → "<h1>L1 - 기본 SSR</h1>"
     └─ <p class="sub"> ...
     └─ <div class="card"> ...   ← 여기서 useState(0), useState(false) 훅 호출
         └─ {hydrated ? ... : ...}  ← hydrated는 false (서버에서는 useEffect가 안 돈다)
     ...
 "</section>"
```

함수 컴포넌트는 호출되고 나면 남는 게 없다 — 반환한 엘리먼트만이 순회의 재료가 된다. 그런데 훅의 상태(`count`, `hydrated`)는 어딘가 살아 있어야 다음 렌더에서 이어진다. 이 "함수가 끝나도 남아 있어야 하는 정보"를 담는 구조가 **Fiber**다. 다음 편([02-fiber.md](02-fiber.md))에서 본격적으로 다루고, 여기서는 "서버 렌더러도 같은 순회 인프라를 쓴다"만 기억하면 된다.

React 18부터 `renderToString`은 스트리밍 렌더러(`renderToPipeableStream`과 같은 Fizz 엔진)의 **동기 모드**로 재구현됐다. 순회와 마크업 생성 로직을 공유하되, 스트림으로 내보내는 대신 끝까지 돌려서 문자열을 모아 반환한다. 그래서 Suspense를 만나도 "나중에 마저"가 불가능하다 — fallback을 즉시 그려넣고 넘어간다.

## 2. 서버 환경의 훅: 같은 코드, 다른 디스패처

`App`은 서버와 클라이언트에서 **같은 코드**로 실행된다. 그런데 `useState`/`useEffect`가 환경마다 다르게 동작한다. 어떻게?

React의 훅은 "현재 렌더러가 설치한 **디스패처(dispatcher)**"를 통해 실제 구현에 연결된다. `useState(initial)`는 대략 `dispatcher.useState(initial)`로 위임된다.

- 브라우저(`react-dom/client`): 상태를 Fiber에 저장하고, setState는 업데이트 큐에 넣고 재렌더를 예약하는 구현.
- 서버(`react-dom/server`): 완전히 다른 구현 —
  - `useState(initial)` → **초기값을 그냥 반환**. setter는 호출해도 아무 일도 일어나지 않는 함수(no-op).
  - `useEffect(fn)` → **등록만 되고 절대 실행되지 않는다.** 서버에는 페인트가 없다.
  - `useId()` → 트리 내 위치로부터 결정적인 id 생성. 서버/클라이언트에서 같은 값이 나와야 하이드레이션이 일치한다.

이게 L1에서 의도적으로 보여주는 장면이다. `App`의 이 분기:

```jsx
const [hydrated, setHydrated] = useState(false)
useEffect(() => { setHydrated(true) }, [])   // 브라우저에서만 실행됨
// ...
{hydrated ? <strong>하이드레이션 완료...</strong> : <span>하이드레이션 전...</span>}
```

서버 HTML에는 항상 "하이드레이션 전"이 찍힌다. 버그가 아니라 서버 디스패처의 정상 동작이다.
그리고 브라우저에서 `useEffect`가 `setHydrated(true)`를 실행하는 순간 — 그 순간이 "하이드레이션 완료, 이제 JS가 페이지를 조작할 수 있다"는 뜻이다([04편](04-hydration.md)에서 이 효과를 붙이는 과정을 해부한다).

여기서 한 가지 제약이 따라온다. 서버 HTML은 `hydrated === false` 상태로 만들어졌으니, 클라이언트의 **첫 렌더**도 정확히 `hydrated === false`여야 한다. `useState(false)` 초기값이 서버/클라이언트에서 같으므로 성립한다. 이 "첫 렌더 일치" 의무가 hydration mismatch라는 주제이고, 04편에서 본격적으로 다룬다.

## 3. 문자열 직렬화: 마크업 생성과 이스케이프

호스트 엘리먼트(`<div>`, `<h1>`)를 만나면 렌더러는 다음을 순서대로 한다:

1. **여는 태그 + 속성**: props를 HTML attribute로 변환한다. `className` → `class`, `htmlFor` → `for`, 불리언 속성 처리, `style` 객체 → `style="..."` 문자열. 이벤트 핸들러(`onClick`)는 **버린다** — HTML에는 함수를 담을 수 없다. 이게 "SSR HTML은 상호작용을 잃고 태어난다"는 말의 물리적 원인이다.
2. **children 순회**: 텍스트는 HTML 이스케이프(`<`, `>`, `&`, `"`) 후 삽입. 숫자/불리언/null 처리 규칙 적용(`false`, `null`, `undefined`는 렌더링되지 않음).
3. **닫는 태그** (void 엘리먼트가 아니면).

L1의 결과물에서 한 가지 흔적이 보인다:

```html
<!-- 서버 HTML의 텍스트 사이 -->
현재 상태:<!-- --> <span class="dim">하이드레이션 전 - ...</span>
<button>카운트: <!-- -->0</button>
```

JSX에서 텍스트 노드끼리 바로 붙으면(`카운트: {count}`처럼 텍스트 뒤에 `{표현식}`이 오면) React는 그 경계에 `<!-- -->`(빈 주석)를 남긴다. 사이에 엘리먼트가 끼면(`이 HTML은 <code>...</code>에서`) 텍스트 노드가 이미 나뉘어 있으므로 주석이 붙지 않는다. 하이드레이션 때 클라이언트가 텍스트 노드를 서버와 **똑같은 개수와 위치**로 쪼개 맞추기 위한 표식이다. "빈 주석이 왜 있지?"가 아니라 "텍스트 노드의 경계 표식이다"라고 읽으면 된다.

## 4. 데이터는 어떻게 경계를 건너는가

클라이언트가 같은 트리를 재현하려면 렌더링에 쓴 입력(props)이 똑같이 필요하다. L1은 가장 단순한 방법을 쓴다:

```jsx
// 서버: props를 HTML 안에 스크립트로 심는다
`<script>window.__PROPS__ = ${embedJson(props)}</script>`
```

```jsx
// 클라이언트(custom/src/l1/entry.client.jsx): 그걸로 같은 트리를 렌더
hydrateRoot(document.getElementById('root'), <App {...window.__PROPS__} />)
```

`embedJson`에는 작지만 중요한 방어가 있다:

```js
// custom/src/shared/chrome.js
export function embedJson(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c')
}
```

JSON 안에 `</script>`가 등장하면 스크립트 태그가 조기에 닫혀 버린다(그리고 그 자리에 공격자가 HTML을 끼워넣을 수 있다). `<`를 `\u003c`로 치환하면 JSON 파싱 결과는 동일하면서 태그 탈출만 막힌다. 실제 프레임워크들(Next, Remix)도 같은 류의 이스케이프를 내부에서 한다.

데이터를 서버에서 클라이언트로 옮겨 심는 이 패턴을 **dehydrate/rehydrate**라고 부른다 — 서버가 상태를 "말리고"(serialize), 클라이언트가 그걸로 "되살린다"(hydrate). `window.__PROPS__`, `window.__DATA__`, `__NEXT_DATA__`, Remix의 single-fetch 페이로드가 전부 이 패턴의 변형이다.

## 5. renderToString의 세 가지 한계 (그래서 L2로 간다)

동기 순회라는 단순함이 만든 한계는 명확하다:

1. **이벤트 루프 블로킹.** 순회가 끝날 때까지 Node 서버는 이 요청에 묶인다. 같은 프로세스의 다른 요청도 기다린다.
2. **0바이트 응답.** 전체 문자열이 완성될 때까지 브라우저는 아무것도 받지 못한다. 페이지 중간에 2.5초 걸리는 데이터가 있으면 TTFB가 2.5초다. (그래서 SSR은 보통 렌더 전에 데이터를 다 준비해둔다 — L3의 loader가 그 구조화다.)
3. **Suspense 무력.** 컴포넌트가 Promise를 던지며 "기다려달라"고 해도, 동기 순회는 기다릴 방법이 없어 fallback으로 대체한다.

세 한계의 뿌리는 같다 — **한 번에, 끝까지, 동기적으로**. 이 제약을 푸는 열쇠는 렌더링을 "작업 단위"로 쪼개는 것이고, 그 작업 단위가 Fiber다.

## 정리

- `renderToString`은 엘리먼트 트리를 깊이 우선으로 순회하며, 함수 컴포넌트는 호출하고 호스트 엘리먼트는 문자열로 직렬화한다.
- 서버 환경의 훅 디스패처는 상태를 저장하지 않는다 — `useState`는 초기값, `useEffect`는 실행 안 됨. 그래서 같은 컴포넌트 코드가 서버에서 안전하게 돈다.
- 이벤트 핸들러는 HTML에 담기지 않으므로, SSR HTML은 하이드레이션 전까지 상호작용이 불가능하다.
- 렌더링 입력(props/데이터)은 HTML에 직렬화해 보내야 클라이언트가 같은 트리를 재현할 수 있다. `</script>` 탈출 방지는 필수.
- 동기 블로킹이라는 근본 한계 → 다음 편에서는 React가 트리를 처리하는 진짜 자료구조(Fiber)를 보고, 그다음 편에서 스트리밍으로 간다.
