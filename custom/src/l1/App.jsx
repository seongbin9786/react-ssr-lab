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
      <h1>L1 - basic SSR</h1>
      <p className="sub">
        <code>renderToString</code> for HTML generation → <code>hydrateRoot</code> for wiring up events. The most basic SSR renderer.
      </p>

      <div className="card">
        <h2>Rendering info</h2>
        <p>
          This HTML was generated at <code>{renderedAt}</code> in <code>{renderedBy}</code>.
        </p>
        <p>
          Current state:{' '}
          {hydrated ? (
            <strong style={{ color: 'var(--good)' }}>hydration complete - the button below works (client JS)</strong>
          ) : (
            <span className="dim">before hydration - HTML only, the button does not work</span>
          )}
        </p>
        <button onClick={() => setCount((c) => c + 1)}>count: {count}</button>{' '}
        <span className="dim">Try clicking before/after JS loads (the Network tab lets you throttle JS)</span>
      </div>

      <div className="card">
        <h2>How it works</h2>
        <ol>
          <li>
            <strong>Server</strong>: turns the React tree into an HTML string with <code>renderToString</code> and responds.
            The browser can paint content even without JS, so the first screen is fast and it's also advantageous for SEO.
          </li>
          <li>
            <strong>Browser</strong>: loads the JS bundle and calls <code>hydrateRoot</code>.
            Hydration doesn't recreate the DOM from scratch — instead, it walks the existing HTML to build the React fiber tree and attaches event listeners.
          </li>
          <li>
            <strong>Props serialization</strong>: the props used on the server (<code>renderedAt</code>) are embedded into the HTML as <code>window.__PROPS__</code>.
            The client must render exactly the same result with the same values, and if they differ a hydration mismatch warning appears.
          </li>
        </ol>
      </div>

      <div className="card">
        <h2>Why this is the ceiling of "basic"</h2>
        <ul>
          <li><code>renderToString</code> is <strong>synchronous</strong>. It blocks the Node event loop until it finishes rendering the entire page.</li>
          <li>It can't send even one byte of HTML until the <strong>whole page string is complete</strong>. If there's slow data in the middle, the entire response is delayed.</li>
          <li>Hydration also loads and executes <strong>all</strong> component code at once. Even for parts the user won't interact with right away.</li>
        </ul>
        <p className="dim">This is why L2 moves on to streaming (renderToPipeableStream + Suspense).</p>
      </div>
    </section>
  )
}
