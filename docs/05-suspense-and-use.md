# 05 — Suspense와 use()의 내부

L2의 데이터 로딩 코드는 이렇다:

```jsx
// custom/src/l2/App.jsx
function CommentList({ db }) {
  const { comments } = use(db.commentsPromise)   // pending이면? "일시 중단"
  return ...
}
```

"Promise를 던진다", "suspend된다", "fallback이 보여진다" — 이 말들이 물리적으로 무슨 뜻인지 이 글에서 정리한다. 그리고 이 메커니즘이 서버(Fizz)와 클라이언트(Fiber reconciler) 양쪽에서 어떻게 같은 코드로 동작하는지, 하이드레이션에서는 왜 "이미 이행된 Promise"가 필요한지까지 다룬다.

이 글의 소스 인용은 전부 이 레포의 `react-dom@19.2.8` 빌드(`node_modules/react-dom/cjs/`)에서 직접 확인한 것이다.

---

## 1. suspend의 실체: 예외 던지기

React에서 "일시 중단(suspend)"의 구현은 놀랍도록 원시적이다 — **thenable을 예외로 던진다.**

`use(promise)`의 클라이언트 구현(`react-dom-client.development.js`, `trackUsedThenable`)의 핵심 분기:

```js
switch (thenable.status) {
  case "fulfilled":
    return thenable.value;          // ← 이미 이행됨: 값을 동기 반환
  case "rejected":
    throw thenable.reason;          // ← 거부됨: 이유를 그대로 throw (에러 바운더리행)
  default:
    // 아직 상태가 없는 Promise: .then을 걸어 상태 기록을 예약하고
    thenable.status = "pending";
    thenable.then(
      (v) => { thenable.status = "fulfilled"; thenable.value = v },
      (e) => { thenable.status = "rejected"; thenable.reason = e },
    );
    throw thenable;                 // ← pending: Promise 자체를 throw = "suspend"
}
```

세 가지가 보인다:

1. **Promise는 `status`/`value`/`reason` 필드를 가진 객체로 격상된다.** React는 첫 조회 시 `.then`을 걸어 이행/거부 시점에 이 필드를 기록한다. 그 뒤로는 이 필드만 보면 되므로, 두 번째 조회부터는 콜백 대기 없이 결과를 안다.
2. **pending Promise는 렌더 함수 밖으로 throw된다.** 컴포넌트 실행이 중간에 끊긴다.
3. **fulfilled Promise는 그 자리에서 값을 반환한다.** suspend가 없다. 이 한 줄이 하이드레이션과 RSC의 직렬화 데이터 재구성을 떠받친다(4절).

던져진 Promise는 누가 잡나? **가장 가까운 `<Suspense>` 경계**의 렌더 로직이다(렌더 페이즈의 try/catch). 경계는 다음을 한다:

1. 자기 자손의 렌더를 중단하고 **fallback을 렌더**한다.
2. 던져진 Promise에 `.then`으로 **ping을 등록**한다 — 이행되면 이 경계의 재렌더를 예약.
3. 재렌더 시점에 컴포넌트는 `use()`를 다시 호출하고, 이번엔 `status === "fulfilled"`라 값이 나온다(1번의 필드 기록 덕분).

"Promise를 던지고, 기다렸다가, 같은 자리를 다시 렌더링한다" — throw와 재시도의 루프가 Suspense의 전부다. async/await가 콜 스택을 얼리는 방식이라면, Suspense는 **예외와 재렌더로 같은 효과**를 만든다. 컴포넌트가 평범한 동기 함수여야 한다는 제약(렌더 중에 await 불가)을 우회하는 방법이기도 하다.

### use()는 훅이면서 훅이 아니다

`use()`의 구현은 다른 훅과 모양이 다르다:

```js
function use(usable) {
  if (usable !== null && typeof usable === "object") {
    if (typeof usable.then === "function") return useThenable(usable);
    if (usable.$$typeof === REACT_CONTEXT_TYPE) return readContext(usable);
  }
  throw Error("An unsupported type was passed to use(): " + String(usable));
}
```

훅 리스트의 인덱스를 쓰지 않는다(02편에서 훅은 호출 순서로 식별된다고 했다). Promise 조회는 렌더마다 **thenableState라는 별도 캐시**에 기록된다. 그래서 `use()`는 조건문·반복문 안에서도 호출할 수 있는 유일한 "훅"이고, Context 읽기(`useContext`의 제약 없는 버전)에도 쓰인다.

주의할 경고 하나: 렌더 중에 Promise를 **새로 만들면** 매 렌더마다 다른 객체가 되어 캐시가 무너지고, React는 "uncached promise" 경고를 낸다. Promise는 렌더 바깥(라이브러리/프레임워크의 캐시 계층)에서 만들어 들어와야 한다 — L2가 `db` 객체를 props로 주입하는 이유다.

## 2. 서버에서의 Suspense: 같은 throw, 다른 수습

서버 렌더러(Fizz)에도 같은 `trackUsedThenable`이 있다(`react-dom-server.node.development.js`). 차이는 수습 방식뿐:

```js
// 서버 버전의 결말 부분
suspendedThenable = thenable;
throw SuspenseException;      // 내부 마커 예외로 변환해 던짐
```

- **클라이언트(Fiber)**: 경계가 fallback으로 다시 렌더링되고, ping이 오면 재렌더. DOM이 실제로 바뀐다.
- **서버(Fizz)**: 경계의 세그먼트를 **placeholder**로 내보내고(03편의 `<!--$?--><template id="B:N">fallback<!--/$-->`), Promise 이행 시 새 task가 그 경계의 실제 콘텐츠를 스트림에 추가 플러시한다. DOM 교체가 아니라 **HTML 추가 송출 + `$RC` 스크립트**다.

던지는 쪽(컴포넌트 코드)은 양쪽에서 동일하고, 잡는 쪽(렌더러)이 환경에 맞는 수습을 한다. 이게 "같은 컴포넌트 코드가 서버와 클라이언트에서 동작한다"의 실체 중 하나다.

`renderToString`만 예외다 — 동기 순회라 Promise 이행을 기다릴 방법이 없으니, Suspense를 만나면 **fallback을 즉시 그려서** 반환한다(React 문서 명시). 기다림이 필요한 SSR은 반드시 `renderToPipeableStream`/`prerender` 계열이어야 한다.

### 서버 컴포넌트의 `async function`은 왜 되는가

RSC 맥락에서 `async function PostFeed()` 같은 컴포넌트가 허용되는 이유도 이제 보인다 — 서버 렌더러는 던져진 Promise를 잡고 기다렸다가 마저 렌더링할 수 있다(스트리밍). 반대로 클라이언트 컴포넌트를 async로 만들면, React 19는 일정 횟수 이상 suspend가 반복될 때 다음 에러를 던진다:

> "An unknown Component is an async Client Component. Only Server Components can be async at the moment."

클라이언트 reconciler도 Promise를 잡을 수는 있지만(다시 렌더하면 되므로), async 클라이언트 컴포넌트의 상태/이펙트 시맨틱이 아직 정의되지 않았기 때문에 막아둔 것이다. (위 에러 메시지는 이 레포의 `react-dom` 빌드에서 직접 확인한 문구다.)

## 3. Suspense 경계는 하이드레이션의 단위이기도 하다

04편에서 selective hydration이 **Suspense 경계 단위**로 진행된다고 했다. 그 연결고리가 여기 있다: 경계는 서버에서 "하나의 스트리밍 단위"(세그먼트 + 마커)였고, 클라이언트에서는 "하나의 suspend/retry 단위"이며, 하이드레이션에서는 "하나의 하이드레이션 단위"다. 같은 경계 구조가 세 국면에서 재사용된다.

마커(`<!--$?-->` → `$~` → `$`)는 이 세 국면의 공용 좌표다. 서버가 경계의 상태를 기록하고, `$RV` 스크립트가 교체를 마치고, 클라이언트 React가 그 좌표를 기준으로 경계를 하이드레이션하거나 retry한다.

## 4. 하이드레이션의 핵심 트릭: 이미 이행된 Promise

04편에서 본 L2의 클라이언트 엔트리를 `use()`의 눈으로 다시 보자:

```jsx
// custom/src/l2/entry.client.jsx
const db = {
  postsPromise: Promise.resolve(window.__DATA__.posts),
  commentsPromise: Promise.resolve(window.__DATA__.comments),
}
hydrateRoot(document.getElementById('root'), <App db={db} />)
```

서버 HTML의 댓글 섹션은 `use(db.commentsPromise)`가 **suspend → 2.5초 후 이행 → 재렌더**된 결과로 만들어졌다. 하이드레이션이 이 HTML과 일치하려면, 클라이언트의 첫 렌더에서 같은 값이 나와야 한다. 두 가지 질문이 생긴다.

**Q1. Promise를 다시 만들면 서버와 값이 다른 것 아닌가?**
아니다. 값은 `window.__DATA__`에서 온다 — 서버가 렌더링에 쓴 바로 그 데이터를 직렬화해 둔 것(01편의 dehydrate). 입력이 같으니 출력도 같다.

**Q2. `Promise.resolve(...)`는 아직 `status` 필드가 없는데, 첫 렌더에서 suspend되지 않나?**
1절의 구현을 그대로 대입하면: 첫 `use()` 호출에서 status 미설정 → `.then` 등록 + `status='pending'` + **throw** → 경계 suspend. 그리고 마이크로태스크에서 이행 콜백이 `status='fulfilled'`를 기록하고, ping이 경계를 재시도해 이번엔 동기 반환.

즉 `Promise.resolve` 트릭은 "throw 없이 읽힌다"가 아니라 **"throw 후 마이크로태스크 만에 재시도되어 사실상 즉시 읽힌다"** 가 정확한 설명이다. 하이드레이션 중의 suspend는 이미 그려진 DOM을 지우지 않고 그 경계의 하이드레이션을 미루는 것이라(04편), 화면 변화 없이 재시도가 일어난다.

그리고 한 단계 더 정교한 버전이 있다: `use()`는 **`status` 필드가 `"fulfilled"`로 미리 설정된 thenable을 진짜로 동기 반환**한다(1절의 첫 분기). 실제 프레임워크의 flight/hydration 런타임은 직렬화된 데이터를 되살릴 때 이 필드가 세팅된 thenable을 만들어 준다 — throw 자체가 없는 순수 동기 읽기. L2의 `Promise.resolve`는 그 패턴을 표준 API만으로 재현한 것이고, 실전 런타임은 한 발 더 나아간 것이다.

```
데이터 재구성의 스펙트럼:
재fetch (워터폴 회귀)
 → Promise.resolve(직렬화 데이터)   … L2: throw 1회 + 마이크로태스크 재시도
 → { status:'fulfilled', value } 사전 세팅  … 실전 런타임: 완전 동기 읽기
```

## 5. use()가 만들어낸 설계 변화

정리하면 `use()`는 세 문제를 한 번에 풀었다:

1. **서버/클라이언트 동일 코드**: 같은 `use(promise)`가 서버에서는 스트리밍을, 클라이언트에서는 suspend/retry(또는 동기 읽기)를 만든다. L2에서 서버 엔트리와 클라이언트 엔트리가 **같은 `App` 컴포넌트**를 쓸 수 있는 이유가 이것이다.
2. **데이터와 렌더의 결합**: "데이터를 준비해서 props로 전달" 대신 "렌더 중에 읽는다"가 되어, 데이터 의존성이 컴포넌트 트리 안에 남는다. RSC의 `async` 서버 컴포넌트는 이 방향의 끝점이다(06편).
3. **하이드레이션 정합성 도구**: 직렬화 데이터를 thenable로 포장하는 것만으로 "재fetch 없는 일치 하이드레이션"이 성립한다.

## 정리

- suspend의 실체는 **thenable throw**다. 가장 가까운 Suspense 경계가 잡고, fallback을 렌더하고, 이행 시 재렌더한다.
- `use()`는 Promise를 `status`/`value`/`reason` 필드 가진 객체로 승격시켜 캐시한다. `fulfilled`면 동기 반환, `pending`이면 throw.
- 서버(Fizz)와 클라이언트(Fiber)는 같은 throw를 각각 "placeholder + 추가 스트리밍"과 "fallback + 재렌더"로 수습한다. `renderToString`은 기다릴 수 없어 fallback을 즉시 그린다.
- Suspense 경계는 스트리밍 단위 = suspend 단위 = 하이드레이션 단위다. 마커(`$?`/`$~`/`$`)가 세 국면의 공용 좌표다.
- 하이드레이션의 데이터 일치는 "직렬화 → thenable 재포장"으로 성립하며, `status` 필드가 세팅된 thenable은 완전 동기 읽기가 된다.
