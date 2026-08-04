# 02 — Fiber: 모든 렌더러의 뼈대

01편 마지막의 질문으로 시작한다. 컴포넌트는 그냥 함수다. 함수는 호출되면 실행되고, 끝나면 스택 프레임이 사라진다. 그런데 React 컴포넌트는:

- 렌더 사이에 상태(`useState`)를 유지해야 하고,
- 렌더링을 **중간에 멈췄다가** 다시 이어야 하고(동시성),
- 잘못되면 그 전 상태로 되돌릴 수 있어야 한다.

"끝나면 사라지는 호출"로는 이걸 못 만든다. React의 답은 함수 호출을 **오래 살아남는 객체**로 바꾸는 것이었고, 그 객체가 **Fiber**다.

이 글은 Fiber가 무엇인지, 어떤 필드를 갖는지, React가 어떤 순서로 Fiber 트리를 걷는지를 설명한다. SSR과 하이드레이션은 전부 이 인프라 위에서 일어나므로, 시리즈 전체의 지반이다.

---

## 1. 정의: 작업 단위이자 가상 스택 프레임

Fiber를 설계한 Andrew Clark의 정의는 두 문장이다:

> Fiber는 **작업 단위(unit of work)** 다.
> Fiber는 **가상 스택 프레임(virtual stack frame)** 이다.

**작업 단위**라는 말은 스케줄링 관점이다. "앱 전체 렌더링"이라는 큰 작업을 Fiber 하나(=컴포넌트 하나 처리)로 쪼개면, 프레임 사이 남는 시간에 조금씩 처리하고, 입력이 들어오면 멈추고, 우선순위가 높은 작업을 먼저 할 수 있다. 스택 기반 렌더링(예전 React의 "stack reconciler")에서는 한 번 시작한 렌더를 끝까지 가는 수밖에 없었다.

**가상 스택 프레임**이라는 말은 자료구조 관점이다. 일반 스택 프레임은 함수가 반환되면 사라지지만, Fiber는 메모리에 남는 객체라서 그 안에 들어 있는 정보(컴포넌트 타입, props, 상태, 진행 상황)가 유지된다. 실제 스택처럼 `return`(돌아갈 곳)·`child`(다음에 들어갈 곳)·`sibling`(다음 형제) 포인터를 갖되, 스택과 달리 언제 멈추고 재개해도 안전하다.

## 2. Fiber 노드 해부 (React 19.2.x `ReactFiber.js` 기준)

Fiber는 이런 필드를 가진 평범한 JS 객체다. 전부 외울 필요는 없고, 역할별로 묶어서 보자.

```js
{
  // ── 무엇인가 ──
  tag,              // Fiber의 종류 (함수 컴포넌트, 호스트 컴포넌트, Suspense 경계 등)
  type,             // 컴포넌트 함수/클래스, 또는 'div' 같은 태그명
  key,              // 리스트에서 재사용 판별용
  stateNode,        // 실제 결과물 참조: DOM 노드, 클래스 인스턴스 등

  // ── 트리 구조 (연결 리스트) ──
  return,           // 부모
  child,            // 첫 번째 자식
  sibling,          // 다음 형제
  index,

  // ── 입력과 출력 ──
  pendingProps,     // 이번 렌더에 받은 props
  memoizedProps,    // 지난 렌더의 props (같으면 재사용 판별)
  memoizedState,    // 지난 렌더의 상태. 함수 컴포넌트에서는 훅 연결 리스트의 머리
  updateQueue,      // 대기 중인 상태 업데이트 큐
  dependencies,     // Context 구독 등 무효화 판별 정보

  // ── 커밋할 변경사항 ──
  flags,            // 이 노드에 필요한 작업 (Placement | Update | Deletion ... 비트 플래그)
  subtreeFlags,     // 자손 트리에 필요한 작업의 합
  deletions,        // 지울 자식 목록

  // ── 스케줄링 ──
  lanes,            // 이 노드에 걸린 업데이트의 우선순위(비트마스크)
  childLanes,       // 자손 쪽에 남아 있는 작업의 우선순위

  // ── 이중 버퍼링 ──
  alternate,        // "다른 쪽 트리의 나"
}
```

### 트리는 child/sibling/return 연결 리스트

Fiber 트리는 자식 배열을 쓰지 않는다. `child`(첫째) → `sibling`(다음 형제) 체인에 `return`(부모) 역방향 포인터를 더한 연결 리스트다. 자식이 몇 명이든 포인터 3종이면 표현되고, 순회 중 어느 지점에서 멈춰도 "다음에 갈 곳"이 포인터 하나로 정해진다. 이 설계 자체가 중단/재개를 전제로 한다.

이 레포 L1의 `<App>`을 Fiber 트리로 그리면:

```
        [App]
          │ child
      [section]
       │      ╲ sibling ...
     [h1]     [div.card] ...
       │
     (text)
```

순회 관점에서 각 노드는 "여기서 시작(child), 끝나면 옆(sibling), 옆도 없으면 위로(return)"라는 삼거리 표지판이다.

### memoizedState는 훅 연결 리스트의 머리

함수 컴포넌트 Fiber에서 `memoizedState`는 단일 값이 아니라 **훅들의 연결 리스트** 첫 노드다:

```js
// 훅 노드의 형태 (ReactFiberHooks)
{ memoizedState: <이 훅의 값>, baseState, baseQueue, queue, next }
```

`useState(a); useState(b)`를 호출하면 리스트는 `훅1(a) → 훅2(b) → null`이 된다. **이것이 "훅은 조건문 안에서 호출하면 안 된다"의 물리적 이유다** — 훅은 이름이 아니라 **호출 순서(리스트의 몇 번째 노드인가)** 로 식별된다. 조건부로 훅을 건너뛰면 다음 렌더에서 리스트의 순서가 어긋나고, `useState(b)` 자리에 `a`가 읽히는 식의 사고가 난다.

## 3. 두 페이즈: 렌더(계산)와 커밋(적용)

React는 업데이트를 두 단계로 나눠 처리한다. 이 분리가 React 동작 방식의 대부분을 설명한다.

### 렌더 페이즈 — 계산만, DOM은 건드리지 않음

1. 루트에서부터 `beginWork`가 아래로 내려간다. 각 Fiber에서: 이전 props/state와 비교해 다시 렌더할지 판단 → 컴포넌트면 함수를 호출(클래스면 `render()`) → 반환된 엘리먼트로부터 **자식 Fiber들을 생성하거나 재사용**.
2. 자식이 없으면 `completeWork`로 그 노드를 마무리한다(호스트 컴포넌트면 DOM 요소 생성 준비, props diff).
3. `child → sibling → return` 순서로 전체 트리를 훑고, 변경이 필요한 노드들에 `flags`를 남긴다.

이 페이즈의 산출물은 DOM 변경이 아니라 **flags가 찍힌 work-in-progress Fiber 트리**다. DOM을 안 건드리므로 중단해도 사용자에게 보이는 피해가 없다. 그래서 이 페이즈는 **비동기·중단 가능**하다.

### 커밋 페이즈 — 일괄 적용, 동기

렌더 페이즈가 끝나면 React는 flags가 있는 노드들만 모아 **한 번에, 동기적으로** DOM에 반영한다: 배치(삽입/이동) → 업데이트(속성/텍스트) → 삭제 순. 커밋이 동기인 이유는 부분 적용된 화면을 사용자가 보면 안 되기 때문이다.
커밋 직후 `useEffect` 등 이펙트가 예약되고(이펙트도 한 번에 안 돌고 스케줄된다 — 페인트 이후), 새 트리가 `current`가 된다.

L1의 `App`에서 `count` 버튼을 누르면: 렌더 페이즈가 새 Fiber 트리를 계산하고(이때 화면은 아직 `count: 0`), 커밋이 텍스트 노드 하나를 바꾼다. "렌더가 두 번 돌았다"는 말은 렌더 페이즈가 두 번 실행됐다는 뜻이지 화면이 두 번 바뀌었다는 뜻이 아니다.

### 순회 순서 실습

```
      A
     / \
    B   C
   / \
  D   E
```

`beginWork`/`completeWork` 순서는:

```
begin A → begin B → begin D → complete D
       → begin E → complete E → complete B
       → begin C → complete C → complete A
```

깊이 우선으로 내려가다, 자식이 없는 노드에서 완료 처리 후 형제나 부모로 빠진다. 이 순회는 재귀가 아니라 **루프 + 포인터**로 구현돼 있다(중단하려면 재귀 스택이 아니라 포인터만 저장하면 되니까).

## 4. current와 work-in-progress: 이중 버퍼링

React는 Fiber 트리를 **두 벌** 유지한다.

- **current 트리**: 지금 화면에 보이는 상태.
- **work-in-progress(WIP) 트리**: 렌더 페이즈가 작업 중인 초안.

렌더 페이즈는 WIP 쪽에서만 일한다. 기존 Fiber는 `alternate` 필드로 WIP의 대응 노드와 서로를 가리킨다 — 새로 만들 수 있으면 만들고, 재사용할 것은 `alternate`를 뒤집어 쓴다(할당 최소화). 커밋이 끝나면 React는 `fiberRoot.current` 포인터를 WIP 쪽으로 바꿔치기한다 — 그 순간 WIP가 current가 되고, 이전 current는 다음 렌더의 WIP 재료로 재활용된다.

```
커밋 전:  current ──▶ [트리 A]   WIP ──▶ [트리 B]  (alternate로 서로 연결)
커밋 후:  current ──▶ [트리 B]   WIP ──▶ [트리 A]  (다음 렌더의 초안 용도)
```

이 구조 때문에 렌더링을 중간에 폐기해도 안전하다 — WIP를 통째로 버리고 current에서 다시 시작하면 된다. 화면은 항상 current, 즉 완성본만 본다.

## 5. 우선순위: lanes, 그리고 MessageChannel 시간 분할

"멈출 수 있다"면 "무엇 때문에 멈출 것인가"가 필요하다. React 18+에서 우선순위는 **lanes**라는 31비트 비트마스크로 표현된다. 각 업데이트(setState 호출, 이벤트 등)는 lane을 받고, Fiber의 `lanes`/`childLanes` 필드에 "이 서브트리에 이런 우선순위의 일이 있다"가 누적된다. 스케줄러는 높은 비트(급한 일)부터 처리한다.

렌더 루프의 핵심은 단순하다:

```js
// ReactFiberWorkLoop의 workLoopConcurrent (의미상 재구성)
while (workInProgress !== null && !shouldYield()) {
  performUnitOfWork(workInProgress)
}
```

`shouldYield()`가 true를 반환하면 루프를 빠져나가 브라우저에 제어권을 돌려주고, 남은 작업은 나중에 재개된다. 여기서 주의할 점 하나: 교육용 재구현 글들(예: Build your own React)은 `requestIdleCallback`을 쓰지만, **실제 React는 `MessageChannel`로 마이크로태스크를 예약하고 `performance.now()`로 5ms 슬라이스를 재는 방식**을 쓴다 — rIC는 호출 타이밍을 제어하기 어렵고 지원 범위도 좁기 때문이다.

이 lanes 메커니즘은 [04편 하이드레이션](04-hydration.md)에서 결정적인 역할을 한다. 하이드레이션은 낮은 우선순위 lane으로 백그라운드 진행되고, 클릭 같은 상호작용은 더 높은 lane이라서 **하이드레이션을 끊고 끼어들 수 있다** — "클릭한 곳부터 하이드레이션한다"는 마법이 이 한 줄로 설명된다.

## 6. 그럼 서버 렌더링도 Fiber를 쓰는가?

정확한 답은 **아니다** — 하지만 이 질문이 중요하다.

- **클라이언트**(`createRoot`, `hydrateRoot`): 위에서 설명한 Fiber reconciler 전체를 쓴다. 하이드레이션은 Fiber 인프라 없이는 존재 자체가 불가능하다.
- **서버**(`renderToString`, `renderToPipeableStream`): **Fizz**라는 별도의 서버 렌더러 엔진을 쓴다. Fiber 트리를 만들지 않고, 각자의 세그먼트를 렌더링하는 **task** 큐로 동작한다. 다만 "작업 단위로 쪼개고, 중단 가능하게 만든다"는 아이디어는 Fiber와 같고, 훅 디스패처 교체(01편)와 Suspense의 throw/retry 모델(05편)은 공유한다.

둘이 만나는 지점이 **하이드레이션**이다. 서버(Fizz)가 만든 DOM 위에 클라이언트(Fiber reconciler)가 Fiber 트리를 구축하며 부착한다. 그래서 시리즈의 남은 글들은: 03편 = Fizz(task/세그먼트), 04편 = Fiber reconciler의 하이드레이션 모드, 05편 = 둘 다, 06편 = 직렬화된 트리가 다시 Fiber reconciler로 들어가는 과정이다.

## 정리

- Fiber는 컴포넌트당 하나씩 만들어지는 객체로, "상태를 가진 가상 스택 프레임"이다. 함수는 끝나도 Fiber는 남는다.
- 트리는 `child`/`sibling`/`return` 연결 리스트. 순회는 `beginWork`(하향) → `completeWork`(상향) 루프이며, 재귀가 아니라서 중단/재개가 된다.
- 렌더 페이즈(비동기, DOM 미변경, flags 산출)와 커밋 페이즈(동기, 일괄 DOM 적용)의 분리가 React의 일관성을 만든다.
- current/WIP 이중 버퍼링 덕분에 중간 상태는 절대 화면에 안 보이고, 렌더 폐기가 공짜다.
- 우선순위는 lanes 비트마스크, 시간 분할은 MessageChannel 슬라이스. 이 둘이 합쳐져 "급한 일이 끼어들 수 있는 렌더링"이 된다.
- 서버 렌더러(Fizz)는 Fiber를 쓰지 않지만 같은 철학의 task 기반 엔진이고, 둘은 하이드레이션에서 만난다.
