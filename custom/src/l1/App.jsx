import { useEffect, useState } from 'react'

// L1의 App은 서버와 클라이언트에서 완전히 같은 코드로 실행된다.
// 서버: renderToString(<App {...props} />) → HTML 문자열
// 클라이언트: hydrateRoot(root, <App {...props} />) → DOM 재사용 + 이벤트 부착
export function App({ renderedAt, renderedBy }) {
  const [count, setCount] = useState(0)
  const [hydrated, setHydrated] = useState(false)

  // useEffect는 브라우저에서만 실행된다.
  // 이 플래그가 켜지는 순간 = 하이드레이션 완료 = JS가 페이지를 조작할 수 있게 된 순간
  useEffect(() => {
    setHydrated(true)
  }, [])

  return (
    <section>
      <h1>L1 - 기본 SSR</h1>
      <p className="sub">
        <code>renderToString</code>으로 HTML을 만들고 → <code>hydrateRoot</code>로 이벤트를 연결한다. 가장 기본적인 SSR 렌더러.
      </p>

      <div className="card">
        <h2>렌더링 정보</h2>
        <p>
          이 HTML은 <code>{renderedBy}</code>에서 <code>{renderedAt}</code>에 생성됐다.
        </p>
        <p>
          현재 상태:{' '}
          {hydrated ? (
            <strong style={{ color: 'var(--good)' }}>하이드레이션 완료 - 아래 버튼이 동작한다 (클라이언트 JS)</strong>
          ) : (
            <span className="dim">하이드레이션 전 - HTML만 있고 버튼은 동작하지 않는다</span>
          )}
        </p>
        <button onClick={() => setCount((c) => c + 1)}>카운트: {count}</button>{' '}
        <span className="dim">JS 로딩 전/후에 클릭해보자 (네트워크 탭에서 JS를 스로틀링할 수 있다)</span>
      </div>

      <div className="card">
        <h2>동작 원리</h2>
        <ol>
          <li>
            <strong>서버</strong>: <code>renderToString</code>으로 React 트리를 HTML 문자열로 만들어 응답한다.
            브라우저는 JS 없이도 콘텐츠를 페인트할 수 있어 첫 화면이 빠르고 SEO에도 유리하다.
          </li>
          <li>
            <strong>브라우저</strong>: JS 번들을 로드하고 <code>hydrateRoot</code>를 호출한다.
            하이드레이션은 DOM을 처음부터 다시 만들지 않는다 — 기존 HTML을 따라 React 파이버 트리를 구성하고 이벤트 리스너를 부착한다.
          </li>
          <li>
            <strong>props 직렬화</strong>: 서버에서 사용한 props(<code>renderedAt</code>)는 <code>window.__PROPS__</code>로 HTML에 심는다.
            클라이언트는 같은 값으로 정확히 같은 결과를 렌더링해야 하며, 다르면 hydration mismatch 경고가 뜬다.
          </li>
        </ol>
      </div>

      <div className="card">
        <h2>왜 이것이 "기본"의 한계인가</h2>
        <ul>
          <li><code>renderToString</code>은 <strong>동기</strong>다. 전체 페이지 렌더링이 끝날 때까지 Node 이벤트 루프를 막는다.</li>
          <li><strong>전체 페이지 문자열이 완성될 때까지</strong> HTML을 한 바이트도 보낼 수 없다. 중간에 느린 데이터가 있으면 전체 응답이 늦어진다.</li>
          <li>하이드레이션도 <strong>모든</strong> 컴포넌트 코드를 한 번에 로드하고 실행한다. 사용자가 바로 상호작용하지 않을 부분까지.</li>
        </ul>
        <p className="dim">이 때문에 L2에서는 스트리밍(renderToPipeableStream + Suspense)으로 넘어간다.</p>
      </div>
    </section>
  )
}
