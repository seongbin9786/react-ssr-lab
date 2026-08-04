import { renderToString } from 'react-dom/server'
import { chromeTop, chromeBottom } from '../shared/chrome.js'

const LEVELS = [
  {
    href: '/l1',
    title: 'L1 - basic SSR',
    desc: 'The most basic form. renderToString turns the React tree into a string, and hydrateRoot attaches events on the client side. We look at why SSR is needed and the structure of hydration.',
  },
  {
    href: '/l2',
    title: 'L2 - streaming SSR',
    desc: 'renderToPipeableStream + Suspense. It sends the shell first and then inserts slow content in later. This is the technique that solves the problem of the entire response being blocked in L1.',
  },
  {
    href: '/l3',
    title: 'L3 - Remix style (router + loader/action)',
    desc: 'A model that places the router at the center. Loaders fetch data in parallel, mutations happen through actions, and everything starts from an HTML form. After hydration, it becomes an SPA.',
  },
  {
    href: '/l4',
    title: 'L4 - Server Components (the Next direction)',
    desc: 'The server sends not HTML but the component tree itself (flight protocol). Server components send 0 bytes of JS, and client components are hydrated on the client side. We implement a mini RSC.',
  },
  {
    href: '/l5',
    title: 'L5 - Server Functions (the TanStack Start direction)',
    desc: 'The complete opposite direction. All components live on the client side, and the server exposes only functions (RPC). SSR becomes an optional optimization rather than the center of architecture.',
  },
]

function Home() {
  return (
    <section>
      <h1>React SSR Lab</h1>
      <p className="sub">
        React 19-based learning project that implements renderers step by step from basic to advanced. Inspired by Next.js, Remix(React Router), and TanStack Start.
      </p>

      <div className="card">
        <h2>The rendering spectrum</h2>
        <pre className="wire">
{`CSR (pure client rendering)
 --> static SSR (renderToString: HTML generation)
 --> streaming SSR (Suspense + sending shell first)
 --> SSR + data protocol (Remix: loader/action)
 --> server-first components (Next RSC: the server owns components)
 --> client-first + server functions (TanStack Start: RPC)`}
        </pre>
        <p className="dim">
          As you move right, the question of "where do components execute and where does the boundary lie" changes. In L1~L3 the component code exists in both places, and in L4 the component itself is split between server/client, while in L5 the function is split.
        </p>
      </div>

      {LEVELS.map((level) => (
        <a key={level.href} href={level.href} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
          <div className="card">
            <h2>{level.title}</h2>
            <p className="dim" style={{ margin: 0 }}>{level.desc}</p>
          </div>
        </a>
      ))}

      <div className="card">
        <h2>How to explore</h2>
        <ul>
          <li>On each page, open the page source and compare what's inside the HTML with what JS does later.</li>
          <li>In L2, watch the Network tab and you can see the HTML being split up and streaming in.</li>
          <li>In L4, we provide a raw view of the flight payload (component tree protocol).</li>
        </ul>
      </div>
    </section>
  )
}

export function renderHome({ res }) {
  res.setHeader('content-type', 'text/html; charset=utf-8')
  res.end(
    chromeTop({ title: 'home', current: '/' }) + renderToString(<Home />) + chromeBottom()
  )
}
