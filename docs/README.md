# React SSR 내부 원리 시리즈

SSR이 브라우저와 서버 사이에서 실제로 무슨 일을 하는지, React 본체의 수준까지 내려가 설명하는 시리즈.
이 레포지토리의 [`custom/`](../custom/README.md) 구현이 각 편의 "실행 가능한 최소 재현" 역할을 한다.

벤치마킹한 글들과 각 글에서 무엇을 가져왔는지는 [benchmarks.md](benchmarks.md)에 정리했다.

## 읽는 순서

| # | 글 | 핵심 질문 | 대응 구현 |
|---|---|---|---|
| 01 | [renderToString은 어떻게 동작하는가](01-render-to-string.md) | 함수 호출 한 번으로 HTML 문자열이 나오는 과정은? | `custom/src/l1/` |
| 02 | [Fiber: 모든 렌더러의 뼈대](02-fiber.md) | React는 트리를 어떤 자료구조로, 어떤 순서로 처리하는가? | — (React 본체) |
| 03 | [스트리밍 SSR: renderToPipeableStream 해부](03-streaming-ssr.md) | `$RC`, `<template>`, hidden div는 무엇이며 누가 교체하는가? | `custom/src/l2/` |
| 04 | [하이드레이션: hydrateRoot는 DOM을 다시 만들지 않는다](04-hydration.md) | 하이드레이션은 정확히 무엇을 하고, 언제 실패하는가? | `custom/src/l1/`, `l2/` 클라이언트 엔트리 |
| 05 | [Suspense와 use()의 내부](05-suspense-and-use.md) | Promise를 던진다는 건 무슨 뜻이며, 서버와 클라이언트에서 어떻게 같은 코드로 동작하는가? | `custom/src/l2/` |
| 06 | [Flight: 컴포넌트 트리가 네트워크를 건너는 법](06-flight.md) | RSC는 HTML 대신 무엇을 보내며, 클라이언트는 그걸 어떻게 다시 트리로 만드는가? | `custom/src/l4/flight/` |

01 → 06 순서가 의존 순서다. Fiber(02)를 먼저 읽고 시작해도 된다 — 03~06은 전부 Fiber 위에서 동작한다.

## 각 편의 구성 규칙

1. `custom/`의 최소 구현 코드를 먼저 보여준다.
2. React 본체가 실제로 하는 일을 자료구조·순서 수준에서 설명한다.
3. 가능하면 이 레포에서 실측한 결과(HTML, 타이밍)를 증거로 붙인다.
4. 이 레포의 단순화와 실제 React의 차이를 숨기지 않고 적는다.

## 실습

```bash
cd custom
npm install
npm start    # http://localhost:3210 — L1~L5 데모
npm test     # jsdom으로 하이드레이션 검증 (11개 체크)
```

각 글의 "실측" 섹션은 `npm start` 상태에서 브라우저의 Network 탭 / 페이지 소스 보기로 재현할 수 있다.
