import { Suspense, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { registry } from './client-components.jsx'
import { createFlightClient } from './flight/client.jsx'

const flight = createFlightClient(registry)
// 스트림을 즉시 시작한다. 행이 도착할 때마다 use()가 깨우면서 트리가 자란다.
flight.connect('/l4/flight')

function App() {
  const [raw, setRaw] = useState(null)
  const [loading, setLoading] = useState(false)

  async function showWireFormat() {
    setLoading(true)
    try {
      setRaw(await (await fetch('/l4/flight')).text())
    } finally {
      setLoading(false)
    }
  }

  return (
    <section>
      <h1>L4 - Server Components (the Next direction)</h1>
      <p className="sub">
        The server sends <strong>the component tree itself</strong> rather than HTML. The component tree streams through the mini-flight protocol.
      </p>

      <div className="card">
        <p style={{ marginTop: 0 }}>
          Everything below was assembled from the <code>/l4/flight</code> stream (a JSON line every time).
          The server components (header, post list, team status) send <strong>0 bytes of JS</strong> to the browser — only the serialized execution results come down.
          Only <code>Counter</code> and <code>LikeButton</code> are real code in the client bundle.
          The header is displayed immediately, the post list arrives at 1.2 seconds, and the team status streams in at 2.4 seconds.
        </p>
        <Suspense fallback={<div className="skeleton">Waiting for the root chunk...</div>}>
          <flight.Root />
        </Suspense>
      </div>

      <div className="card">
        <h2>Wire format (payload) view</h2>
        <p className="dim" style={{ marginTop: 0 }}>
          The actual protocol is just JSON lines like below. <code>$element</code> is a server-rendered element, <code>$client</code> is a client component reference, and
          <code>$lazy</code> is a streaming slot that will be filled in later by another line with the same id.
        </p>
        <button onClick={showWireFormat} disabled={loading}>
          {loading ? 'Loading...' : raw ? 'Update payload' : 'View the raw payload'}
        </button>
        {raw && <pre className="wire">{raw}</pre>}
      </div>

      <div className="card">
        <h2>Things that are simplified compared to the real Next.js</h2>
        <ul>
          <li>Next embeds the flight stream as script tags inside the initial HTML, so it can be displayed even without JS and hydrated. Here we fetch it after JS boots up.</li>
          <li>Next resolves client component references to actual module URLs via bundler plugins. Here we just use a name-string registry.</li>
          <li>Next can update only part of the tree via flight refetching while preserving client state. Here we only demonstrate the initial stream.</li>
        </ul>
      </div>
    </section>
  )
}

createRoot(document.getElementById('root')).render(<App />)
