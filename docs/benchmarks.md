# 벤치마크 모음: 내부 동작 원리를 상세히 설명하는 글들

이 시리즈([`docs/README.md`](README.md))를 쓰기 전에, "내부 동작 원리를 깊이 있게 설명하는 글"의 기준이 될 만한 글들을 수집하고 분석했다.
아래 글들은 실제로 전체 내용을 읽고 구조·서술 방식을 추출한 것들이다. 각 글에서 무엇을 가져왔는지도 함께 적는다.

---

## 1. Dan Abramov — [React as a UI Runtime](https://overreacted.io/react-as-a-ui-runtime/)

React 코어 팀의 Dan Abramov가 React를 "UI 라이브러리"가 아니라 **호스트 트리를 조작하는 프로그래밍 런타임**으로 재정의하며 내부 개념을 하나씩 쌓아 올리는 글.

**다루는 것:** Host Tree / Renderers / React Elements(영화 프레임에 비유) / Components / Inversion of Control / Lazy Evaluation / State(트리 위치의 메모리) / Consistency(렌더 페이즈와 커밋 페이즈 분리) / Call Tree(Fiber가 왜 필요한가) / Batching / Context(동적 스코핑) / 순수성과 지역 변이

**서술 방식:**
- 제1원칙부터 유도한다. "React가 이렇게 생겼다"가 아니라 "호스트 트리를 업데이트하는 프로그램을 만든다면 어떤 결정이 불가피한가"로 시작해 각 설계를 논리적으로 끌어낸다.
- 숙련 개발자를 대상으로, 사용법이 아니라 **작동 원리와 트레이드오프**를 설명한다.
- 한계를 숨기지 않는다(React가 안 맞는 분야도 명시).

**이 시리즈가 가져온 것:** "왜 이런 구조일 수밖에 없는가"를 먼저 설명하고 코드를 보여주는 순서. 특히 Fiber 글([02](02-fiber.md))의 "함수 호출이 끝나면 스택 프레임이 사라지는데 React는 왜 상태를 유지해야 하는가"라는 문제 제기가 이 글의 Call Tree 설명에서 왔다.

---

## 2. Andrew Clark — [React Fiber Architecture](https://github.com/acdlite/react-fiber-architecture)

Fiber를 설계한 Andrew Clark(acdlite)이 Fiber 아키텍처를 설명하는 문서. Fiber 재설계 초기에 쓰여 일부 용어는 현재 코드와 다르지만, 설계 의도를 읽을 수 있는 1차 자료다.

**다루는 것:**
- Fiber의 정의: **작업 단위(unit of work)** 이자 **가상 스택 프레임(virtual stack frame)**
- 목적: 점진적 렌더링 — 작업을 중단(pause)·재개(resume)·폐기(abort)하고 우선순위를 매길 수 있어야 한다
- Fiber 객체 필드: `type`/`key`, `child`/`sibling`/`return`(연결 리스트 트리), `pendingProps`/`memoizedProps`, `alternate`(이중 버퍼링), `output`(호스트 출력)

**서술 방식:** 데이터 구조(객체 필드)를 먼저 정의하고, 각 필드가 어떤 스케줄링 요구에서 나왔는지 연결한다.

**이 시리즈가 가져온 것:** "Fiber = 가상 스택 프레임"이라는 정의와 `child`/`sibling`/`return` 3포인터 트리 구조 설명. [02-fiber.md](02-fiber.md)에서 현재 React 19 필드명으로 갱신해 사용했다.

---

## 3. Max Koretskyi — [Inside Fiber: in-depth overview of the new reconciliation algorithm in React](https://blog.ag-grid.com/inside-fiber-an-in-depth-overview-of-the-new-reconciliation-algorithm-in-react/)

React 소스 코드(`ReactFiberScheduler.js`, `ReactFiberBeginWork.js` 등)를 직접 추적하며 reconciliation 알고리즘을 해부하는 글.

**다루는 것:**
- 렌더 페이즈(비동기, 중단 가능, DOM 미변경)와 커밋 페이즈(동기, 일괄 DOM 반영)의 분리 — 각 페이즈에서 호출되는 라이프사이클 목록까지
- Fiber 필드 상세: `updateQueue`, `effectTag`(현 `flags`), `memoizedState`, `stateNode`, `tag`
- **`beginWork`(하향, child 반환) → `completeUnitOfWork`(상향/횡향, sibling 또는 return으로)** 순회 알고리즘
- current 트리와 work-in-progress 트리의 이중 버퍼링

**서술 방식:** 추상 설명 대신 실제 함수 이름과 호출 흐름을 따라간다. 카운터 예제 하나로 전체 순회를 보여준다.

**이 시리즈가 가져온 것:** `beginWork`/`completeWork` 순서도와 "커밋 전까지는 DOM을 절대 건드리지 않는다"는 불변칙 강조 방식.

---

## 4. Rodrigo Pombo — [Build your own React](https://pomb.us/build-your-own-react/)

React를 처음부터 재구현(Didact)하며 원리를 설명하는 글. 이 레포지토리의 `custom/` 구현과 정신적으로 가장 가까운 선례다.

**단계:** createElement → render → Concurrent Mode(requestIdleCallback) → Fibers → Render/Commit 분리 → Reconciliation(effectTag) → Function Components → Hooks

**서술 방식:**
- **코드 우선**: 각 단계의 코드를 먼저 보여주고 왜 필요한지 설명한다.
- 이전 단계 코드를 과감히 갈아엎으며 최종 아키텍처로 수렴한다.
- 단순화를 명시한다("We prefer simple code than performant code").
- 변수명을 실제 React와 맞춘다(`wipRoot`, `alternate`, `performUnitOfWork`).

**이 시리즈가 가져온 것:** "최소 구현으로 재현한 뒤 원리를 설명한다"는 이 레포지토리의 방식 자체가 이 글의 방식이다. 글에서도 `custom/` 코드를 먼저 보여주고 React 본체의 동작을 대응시키는 순서를 택했다. 한 가지 차이도 배웠다: 실제 React는 `requestIdleCallback`이 아니라 **MessageChannel 기반 시간 분할**을 쓴다(이 사실은 [02-fiber.md](02-fiber.md)에 반영).

---

## 5. React 공식 문서 — [renderToPipeableStream](https://react.dev/reference/react-dom/server/renderToPipeableStream)

API 문서지만 내부 동작 모델이 본문에 정의되어 있다.

**핵심 정의들:**
- **셸(shell)**: "`<Suspense>` 경계 밖에 있는 부분"
- `onShellReady`: 셸 렌더링 직후 — 여기서 파이프를 시작하면 이후 콘텐츠는 인라인 `<script>`와 함께 스트리밍된다
- `onAllReady`: 전체 완료 — 크롤러/정적 생성용
- `onShellError`: 아직 바이트를 안 보낸 시점의 실패라 CSR 폴백 등으로 전환 가능
- 스트리밍은 "브라우저에서 React가 로드되거나 앱이 인터랙티브해지는 것을 기다릴 필요가 없다"

**이 시리즈가 가져온 것:** 셸의 공식 정의와 콜백 4종의 의미 구분. [03-streaming-ssr.md](03-streaming-ssr.md)의 뼈대.

---

## 6. React 공식 문서 — [hydrateRoot](https://react.dev/reference/react-dom/client/hydrateRoot)

**핵심 정의들:**
- 하이드레이션은 서버 HTML 스냅샷을 "브라우저에서 실행되는 완전한 인터랙티브 앱으로 전환"하는 과정 — 기존 HTML에 **부착(attach)** 하는 것이지 다시 그리는 것이 아니다
- mismatch의 대표 원인: 서버/클라이언트 데이터 불일치, `typeof window !== 'undefined'` 분기, 브라우저 전용 API
- **mismatch는 버그다**: 최악의 경우 "이벤트 핸들러가 잘못된 요소에 연결"된다
- 일부 불일치는 자동 복구되며(`onRecoverableError`), 속성 패치는 보장되지 않는다 — 성능상 전체 마크업을 검증하지 않기 때문
- 하이드레이션 완료 전에 `root.render`를 호출하면 서버 HTML을 지우고 전체를 클라이언트 렌더링으로 전환

**이 시리즈가 가져온 것:** "전체를 검증하지 않는다"는 성능 제약이 [04-hydration.md](04-hydration.md)의 mismatch 감지 방식(선택적 검증) 설명의 근거가 됐다.

---

## 7. React 18 Working Group — [Discussion #37: New Suspense SSR architecture](https://github.com/reactwg/react-18/discussions/37)

React 팀이 스트리밍 SSR + Suspense + selective hydration 설계를 직접 설명한 1차 자료. 이 시리즈에서 가장 많이 참고했다.

**다루는 것:**
- 기존 SSR의 **all-or-nothing 3단 워터폴**: 모든 데이터 페칭 → 모든 JS 다운로드 → 전체 트리 하이드레이션. 각 단계가 전체 단위로만 진행돼 가장 느린 부분이 전체를 볼모로 잡는다
- `<Suspense>`로 앱을 독립 단위로 쪼개 데이터/HTML/하이드레이션을 각자 진행하게 하는 설계
- 구체적 메커니즘: 셸 먼저 → fallback을 placeholder로 전송 → 데이터 준비 시 `<div hidden id="...">`로 콘텐츠 추가 송출 → 인라인 스크립트가 placeholder를 교체. **순서 무관(out-of-order)** 스트리밍
- **selective hydration**: 경계 단위로 하이드레이션, 경계 사이에 브라우저가 숨 쉴 틈(tiny gaps)이 있어 저사양 기기도 멈추지 않음. 사용자가 미완료 영역을 클릭하면 capture 페이즈에서 해당 경계를 **동기 하이드레이션**
- HTML alone으로도 콘텐츠가 완성되는 이유: 교체 스크립트가 React 번들 없이 동작하므로 JS 로드가 늦거나 실패해도 콘텐츠는 보인다

**이 시리즈가 가져온 것:** 3단 워터폴 문제 정의, placeholder/hidden/instruction script 3요소 명명, selective hydration의 이벤트 기반 우선순위 메커니즘. [03](03-streaming-ssr.md)·[04](04-hydration.md)편의 근간.

---

## 8. Josh Comeau — [Making Sense of React Server Components](https://www.joshwcomeau.com/react/server-components/)

RSC를 멘탈 모델 중심으로 정리한 글.

**다루는 것:**
- 전개 순서: CSR의 문제 → SSR/하이드레이션 복습 → 기존 메타프레임워크의 한계(라우트 단위 데이터 페칭, 불필요한 하이드레이션) → RSC
- 핵심 명제: 네트워크를 건너는 것이 컴포넌트 **코드**에서 컴포넌트 **실행 결과(직렬화된 값)** 로 바뀐다
- 서버 컴포넌트는 **한 번만 실행**되고 리렌더링되지 않는다 — 그래서 state/effect 훅이 금지된다
- `'use client'`가 만드는 **클라이언트 바운더리**, 바운더리로 흘러들어온 서버 출력은 변경 불가능한 정적 데이터
- RSC는 SSR을 대체하는 게 아니라 그 위에 쌓인다. 서버 컴포넌트 출력은 하이드레이션 대상에서 제외

**서술 방식:** "왜 이 기능이 생겼는가"를 역사 순으로 풀고, 추상 멘탈 모델과 실제 페이로드 스니펫을 반복적으로 짝짓는다.

**이 시리즈가 가져온 것:** "네트워크를 건너는 것이 무엇인가"라는 하나의 질문으로 RSC를 규정하는 프레이밍. [06-flight.md](06-flight.md)의 출발점.

---

## 9. Vercel — [Understanding React Server Components](https://vercel.com/blog/understanding-react-server-components)

**다루는 것:**
- SSR의 남은 문제: all-or-nothing 하이드레이션 + 앱이 커질수록 늘어나는 JS
- RSC는 서버 컴포넌트와 클라이언트 컴포넌트가 **하나의 트리 안에서 교차(interleaving)** 하며, 직렬화 가능한 값만 경계를 건넌다
- `'use client'` 경계 아래로만 JS가 추가되므로, 앱이 커져도 기본 번들이 비대해지지 않는다
- 클라이언트 컴포넌트는 여전히 SSR+하이드레이션 대상이며, RSC 스트리밍과 하이드레이션이 **동시에** 진행된다

**이 시리즈가 가져온 것:** interleaving(트리가 섞인다)과 "하이드레이션과 스트리밍이 겹쳐서 진행된다"는 포인트.

---

## 수집 기준과 한계

- 기준: "API 사용법"이 아니라 **내부 메커니즘(자료구조, 순서, 페이즈, wire 포맷)** 을 설명하는 글. 1차 자료(React 팀/설계자 본인)를 우선.
- 위 9편은 전부 본문을 직접 읽고 구조를 추출했다.
- `indepth.dev`에 있던 원문(Max Koretskyi의 Inside Fiber)은 현재 404라 ag-grid 블로그로 이전된 주소를 사용했다.
- React 소스 코드 자체(최종 1차 자료)는 `react-dom@19.2.8` 기준으로 직접 확인한 내용을 시리즈에 반영했다. 소스 함수 이름(`beginWork`, `tryToClaimNextHydratableInstance` 등)은 버전마다 달라질 수 있다.
