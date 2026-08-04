# 03 — 스트리밍 SSR: renderToPipeableStream 해부

01편의 한계를 기억하자. `renderToString`은 전부 끝날 때까지 0바이트를 보낸다. 페이지 중간에 2.5초 걸리는 데이터가 있으면 사용자도 크롤러도 2.5초를 기다린다.

스트리밍 SSR의 목표는 한 문장이다: **되는 만큼 먼저 보내고, 늦는 부분은 나중에 제자리에 끼워 넣는다.** 이 글은 React가 그 "나중에 끼워 넣기"를 정확히 어떤 HTML 구조로 해내는지 — 이 레포 L2의 실측 응답을 뜯어서 — 설명한다.

---

## 1. 문제: all-or-nothing 3단 워터폴

React 팀이 React 18 작업 그룹에서 정의한 기존 SSR의 병목은 세 단계였다:

```
[1] 모든 데이터 페칭 완료 ──▶ [2] 모든 HTML 생성 완료 ──▶ [3] 모든 JS 로드 + 전체 하이드레이션
        (가장 느린 쿼리가 TTFB 결정)        (0바이트 응답 구간)         (그제서야 상호작용)
```

각 단계가 **앱 전체 단위**로만 진행되니, 가장 느린 부분이 전체를 볼모로 잡는다. 스트리밍 SSR은 여기서 [1]→[2] 구간을, Suspense 경계 단위로 잘게 쪼개는 것이다:

```
데이터A 완료 ─▶ HTML(A) 송출 ─▶ ...
데이터B 완료 ─▶ HTML(B) 송출 ─▶ ...        ← B가 아무리 느려도 A는 이미 갔다
```

이 레포 L2의 서버 코드([`custom/src/l2/render.server.jsx`](../custom/src/l2/render.server.jsx)):

```jsx
const { pipe } = renderToPipeableStream(<App db={db} />, {
  onShellReady() {
    // 셸이 준비된 즉시 응답 시작. 느린 데이터가 남아 있어도 안 기다린다.
    res.write(chromeTop({ title: 'L2 스트리밍 SSR', current: '/l2' }))
    const passthrough = new PassThrough()
    passthrough.on('data', (chunk) => res.write(chunk))
    passthrough.on('end', async () => {
      // 스트림이 끝나면 직렬화 데이터 + 번들을 꼬리로 붙인다
      res.write(chromeBottom(`<script>window.__DATA__ = ...</script><script src="/static/l2.js"></script>`))
      res.end()
    })
    pipe(passthrough)
  },
  onShellError(error) { /* 아직 바이트를 안 보냈으니 CSR 폴백 등으로 전환 가능 */ },
  onError(error) { /* 셸 이후 스트리밍 중 에러 */ },
})
```

`pipe(res)`가 아니라 `PassThrough`를 경유하는 이유는 스트림 **끝 시점**을 가로채서 HTML 꼬리(데이터 스크립트 + 번들)를 붙이기 위해서다. `renderToPipeableStream`은 콘텐츠 스트림만 책임지고, 문서 껍데기(`<!doctype>`, `<head>`)와 부트 스크립트는 서버 코드가 직접 관리한다 — 실제 프레임워크도 똑같이 한다.

## 2. 셸(shell)이란 무엇인가

React 문서의 정의: **"`<Suspense>` 경계 밖에 있는 부분."**

L2의 [`App.jsx`](../custom/src/l2/App.jsx)에서 셸은 헤더, 설명 카드, "동작 원리" 카드, 그리고 두 Suspense 경계의 **fallback**이다. 경계 안의 `PostList`/`CommentList`는 데이터를 `use()`로 읽는데 아직 pending이므로(05편에서 메커니즘 상세), 그 자리에는 fallback이 그려진다.

`onShellReady`는 셸 렌더링이 완료된 직후에 호출된다. 여기서 파이프를 시작하면:

- **TTFB가 가장 느린 데이터에서 풀려난다.** L2 실측에서 셸은 약 35ms에 도착한다(댓글 데이터는 2.5초).
- 셸에는 스켈레톤이 이미 그려져 있어서, 사용자는 즉시 "페이지가 로딩 중이다"를 본다.

콜백 네 종의 구분:

| 콜백 | 시점 | 용도 |
|---|---|---|
| `onShellReady` | 셸 렌더 완료 직후 | **사람에게** 스트리밍 시작 |
| `onAllReady` | 셸 + 모든 지연 콘텐츠 완료 | 크롤러/사전 렌더링 — 점진 노출 없이 완성본 송출 |
| `onShellError` | 셸 렌더 실패, 아직 0바이트 | CSR 폴백 등 전략 전환 가능 |
| `onError` | 스트리밍 중 에러(복구 가능 여부 무관) | 로깅 등 |

서버 렌더러 자체는 02편에서 말한 **Fizz** 엔진이다 — Fiber가 아니라 task/세그먼트 기반. 각 Suspense 경계는 자기 세그먼트를 가진 task가 되고, 셸 task가 끝나면 `onShellReady`가, 모든 task가 끝나면 `onAllReady`가, pending task 수가 0이 되는 순간 스트림이 닫힌다.

## 3. 실측: pending 경계는 어떤 HTML로 나가는가

`npm start` 후 `/l2`의 페이지 소스에서 셸 부분을 가져왔다(React 19.2.8 실측):

```html
<div class="grid2">
  <!--$?--><template id="B:0"></template>
  <div class="skeleton">게시글<!-- --> 로딩 중... (서버 Suspense fallback)</div>
  <!--/$-->

  <!--$?--><template id="B:1"></template>
  <div class="skeleton">댓글<!-- --> 로딩 중... (서버 Suspense fallback)</div>
  <!--/$-->
</div>
```

구조를 해부하면:

- `<!--$?-->` ~ `<!--/$-->`: Suspense 경계의 시작/끝 주석 마커. **`$?`는 "아직 해결되지 않은 경계"** 라는 뜻이다. 이 마커는 하이드레이션 때 React가 경계를 찾는 좌표가 된다(04편).
- `<template id="B:0"></template>`: 경계의 **핸들**. 빈 템플릿이지만 id가 있어서, 나중에 `$RC` 스크립트와 클라이언트 React가 `document.getElementById('B:0')`으로 이 경계의 위치를 정확히 되찾는다.
- 그 사이: fallback HTML. 사용자에게 지금 보이는 부분.

## 4. 실측: 데이터가 해결되면 무엇이 도착하는가

400ms 후(게시글 데이터 해결), 같은 응답 스트림의 **뒤쪽**에 이런 청크가 도착한다:

```html
<div hidden id="S:0">
  <div class="card"><h2>게시글 (0.4초)</h2><ul>...</ul></div>
</div>
<script>
$RB=[];$RV=function(a){...};$RC=function(a,b){...};$RC("B:0","S:0")
</script>
```

2.5초 후(댓글 데이터 해결) 같은 패턴의 청크가 한 번 더:

```html
<div hidden id="S:1">...댓글 카드...</div>
<script>$RC("B:1","S:1")</script>
```

즉, 지연된 콘텐츠는 **문서 순서상의 제자리가 아니라 스트림의 끝부분**에 도착한다. 대신 두 가지 장치가 따라붙는다:

1. **`<div hidden id="S:N">`**: 실제 콘텐츠를 `hidden`으로 숨겨서 먼저 DOM에 심어둔다(보이지는 않음).
2. **인라인 `<script>$RC(...)</script>`**: 방금 도착한 콘텐츠를 경계 자리로 옮기는 **명령 스크립트**. React가 매 청크마다 함께 내보낸다.

첫 청크에 포함된 `$RC`의 실제 코드는 이렇다(19.2.8, 주석은 필자):

```js
$RC = function(a, b) {
  if (b = document.getElementById(b))              // hidden 콘텐츠 (S:0)
    (a = document.getElementById(a))               // 경계 핸들 (B:0)
      ? (
          a.previousSibling.data = "$~",           // 마커: $? → $~ (콘텐츠 도착, 교체 대기)
          $RB.push(a, b),                          // 즉시 교체하지 않고 배치 큐에 넣는다
          2 === $RB.length && ( ... rAF/타이밍 휴리스틱으로 $RV(배치) 예약 ... )
        )
      : b.parentNode.removeChild(b)
}
```

그리고 배치 플러시 함수 `$RV`:

```js
$RV = function(a) {
  for (var b = 0; b < a.length; b += 2) {
    var c = a[b], e = a[b + 1];                    // [template, hiddenDiv] 쌍
    e.parentNode.removeChild(e);                   // hidden div를 제자리에서 떼고
    var f = c.parentNode;
    // 경계 마커($?...)부터 <!--/$-->까지의 fallback 노드들을 전부 제거한 뒤,
    // hidden div의 자식들을 그 자리에 삽입
    for (; e.firstChild;) f.insertBefore(e.firstChild, c);
    g.data = "$";                                  // 마커: $~ → $ (경계 완료)
    g._reactRetry && requestAnimationFrame(g._reactRetry)  // 대기 중이던 클라이언트 React 깨우기
  }
}
```

여기서 실측으로만 알 수 있는 디테일이 하나 있다: **React 19는 경계가 해결되는 즉시 DOM을 교체하지 않는다.** `$RC`는 교체 작업을 `$RB` 큐에 넣고, 다음 애니메이션 프레임 시점에 `$RV`가 모아서 한 번에 교체한다. 같은 시간대에 해결된 여러 경계의 교체가 한 프레임에 묶이므로 레이아웃 연쇄 재계산(리플로우)이 줄어든다.

### 주석 마커의 상태 기계

경계 마커의 `data`는 경계의 일생을 그대로 기록한다:

```
<!--$?-->  서버에서 pending 경계로 송출 (fallback이 보이는 중)
<!--$~-->  콘텐츠가 도착했고 교체가 예약됨 ($RC가 기록)
<!--$-->   교체 완료 — 이제 이 자리는 실제 콘텐츠  ($RV가 기록)
```

`$`로 끝난 경계는 "서버에서 완전히 해결된 경계"이고, 하이드레이션은 그 HTML을 그대로 채택한다. 만약 JS 번들이 늦게 와서 그사이 하이드레이션이 먼저 시작됐다면? 클라이언트 React는 `$?` 경계를 만나면 fallback을 하이드레이션하고, `$RV`가 호출하는 `_reactRetry` 콜백을 마커에 걸어둔다 — 콘텐츠가 도착하면 그 자리만 다시 하이드레이션한다. (이 레포는 데모 단순화를 위해 번들을 항상 마지막에 붙이므로, 실전에서는 이 순서 경쟁이 실제로 일어난다.)

## 5. 이것이 왜 "JS 없이 완성되는 페이지"인가

위 교체의 전 과정 — hidden 콘텐츠 삽입, `$RC`/`$RV` 실행, fallback 제거 — 은 **React 번들과 무관한** 순수 HTML + 인라인 스크립트다. React 팀이 이 설계를 강조하는 이유:

- JS 번들 로드가 느리거나 실패해도 콘텐츠는 사용자에게 보인다 (점진적 향상).
- 크롤러는 인라인 스크립트를 안 돌려도 된다 — 모든 콘텐츠가 응답 HTML 어딘가에 존재한다. 스크립트를 실행하는 크롤러는 최종 DOM을, 안 하는 크롤러는 원본 HTML을 보지만 콘텐츠 자체는 둘 다 갖고 있다.

다만 순서는 꼬여 있다 — 댓글 섹션의 HTML은 문서의 한참 뒤에 `hidden`으로 붙어 있다. 검색엔진 최적화 관점에서는 `onAllReady`로 완성본을 보내는 전략도 선택지다(02번 표 참고).

## 6. 에러가 나면 어떻게 되는가

경계 안의 컴포넌트가 렌더 중 throw하면(데이터 fetch 실패 등), Fizz는 그 경계를 **에러 상태로** 내보내는 대신 fallback을 유지하고 `onError`를 호출한다. 그리고 클라이언트에서 그 경계를 **다시 렌더링해본다** — 클라이언트에서 성공하면 서버 fallback이 클라이언트 결과로 조용히 교체되고, 사용자는 서버 에러를 모르고 지나간다. 이 "서버 실패 → 클라이언트 재시도" 경로는 하이드레이션의 복구 메커니즘과 같은 것이고, 04편에서 이어서 본다.

셸 자체에서 에러가 나면(`onShellError`) 아직 바이트를 안 보낸 상태이므로 — 500 페이지든 CSR 폴백이든 — 자유롭게 전략을 바꿀 수 있다. 이 "아직 아무것도 안 보냈다"는 보장이 `onShellReady`/`onShellError` 분기의 가치다.

## 7. 이 레포 L2의 단순화와 실제 프레임워크의 차이

L2는 메커니즘 재현에 집중하느라 몇 가지를 단순화했다:

| 단순화 | 실제(Next 등) |
|---|---|
| 직렬화 데이터를 응답 꼬리에 한 덩어리로 붙임 | 경계별로 데이터를 쪼개 해당 콘텐츠와 함께 스트리밍 — 앞선 경계는 뒷 데이터를 안 기다리고 하이드레이션 시작 |
| 클라이언트 번들 1개, 경계별 코드 분할 없음 | Suspense 경계 = 코드 분할 단위. 해당 JS가 도착한 경계부터 하이드레이션(selective hydration, 04편) |
| `window.__DATA__` 전역 변수 | flight 페이로드/스크립트 태그 내장(06편), 또는 single-fetch 스트림(React Router) |
| 에러 경계 재시도 데모 없음 | 위에서 설명한 서버 실패 → 클라이언트 재시도 기본 동작 |

스트리밍의 뼈대(셸/플레이스홀더/hidden/명령 스크립트)는 이 레포와 실제 프레임워크가 동일하다. `/l2` 페이지 소스와 Next.js 페이지 소스의 `self.__next_f.push(...)` 부분을 나란히 보면, 후자가 이 구조 위에 flight 페이로드를 얹은 것임을 확인할 수 있다(06편).

## 정리

- 스트리밍 SSR은 all-or-nothing 3단 워터폴을 Suspense 경계 단위로 쪼갠다.
- 셸(`Suspense` 밖 + fallback들)이 준비되는 즉시 `onShellReady`로 응답을 시작한다.
- pending 경계는 `<!--$?--><template id="B:N">fallback<!--/$-->`로 나간다.
- 데이터가 해결되면 `<div hidden id="S:N">` + 인라인 `$RC` 스크립트가 도착하고, React 19는 교차를 한 프레임 단위로 배치(`$RB`/`$RV`)해서 적용한다. 마커는 `$?` → `$~` → `$`로 진행된다.
- 이 전 과정은 React 번들 없이 동작하므로, HTML만으로 콘텐츠가 완성된다.
- 다음 편: 이렇게 완성된 DOM에 `hydrateRoot`가 어떻게 "다시 만들지 않고" 붙는지.
