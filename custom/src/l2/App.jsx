import { Suspense, use } from 'react'

function Skeleton({ label }) {
  return <div className="skeleton">{label} 로딩 중... (서버 Suspense fallback)</div>
}

// use(promise): React 19가 제공하는 방식. Promise가 아직 pending이면
// 렌더링을 "일시 중단(suspend)"시키고, 가장 가까운 Suspense 경계의 fallback을 보여준다.
// 이 동작은 서버 스트리밍 렌더링에서도 똑같이 동작한다.
function PostList({ db }) {
  const { posts, fetchedAt } = use(db.postsPromise)
  return (
    <div className="card">
      <h2>Posts (0.4 seconds)</h2>
      <ul>
        {posts.map((p) => (
          <li key={p.id}>{p.title}</li>
        ))}
      </ul>
      <p className="dim">fetched at {fetchedAt}</p>
    </div>
  )
}

function CommentList({ db }) {
  const { comments, fetchedAt } = use(db.commentsPromise)
  return (
    <div className="card">
      <h2>Comments (2.5 seconds)</h2>
      <ul>
        {comments.map((c) => (
          <li key={c.id}>
            <strong>{c.author}</strong>: {c.text}
          </li>
        ))}
      </ul>
      <p className="dim">fetched at {fetchedAt} — this chunk was streamed in later</p>
    </div>
  )
}

export function App({ db }) {
  return (
    <section>
      <h1>L2 - Streaming SSR</h1>
      <p className="sub">
        <code>renderToPipeableStream</code> + <code>Suspense</code> — send the shell first, and slow chunks get inserted later via inline scripts.
      </p>

      <div className="card">
        <p>
          The HTML for this page did not arrive all at once. The header, nav, and skeleton below were sent <strong>immediately</strong>,
          and after that, as the data finished loading, the real content was streamed in at <strong>400ms</strong> and <strong>2.5 seconds</strong> respectively and swapped into place.
          Check the timing in the Network tab (View Source will also show the <code>$RC</code> inline script and <code>&lt;template&gt;</code> structure).
        </p>
      </div>

      <div className="grid2">
        <Suspense fallback={<Skeleton label="Posts" />}>
          <PostList db={db} />
        </Suspense>
        <Suspense fallback={<Skeleton label="Comments" />}>
          <CommentList db={db} />
        </Suspense>
      </div>

      <div className="card">
        <h2>How it works</h2>
        <ol>
          <li>
            <code>renderToPipeableStream</code> starts rendering, and the moment the <strong>shell</strong> (the parts outside Suspense and all the fallbacks) is ready,
            it fires <code>onShellReady</code>. The server starts piping the response right then. TTFB is no longer hostage to the slowest data.
          </li>
          <li>
            Suspended boundaries are sent as <code>&lt;div hidden id="S:1"&gt;</code> placeholders. When a Promise resolves, React flushes the real content,
            and a small inline script (<code>$RC</code>) swaps the placeholder and the hidden content in the DOM. Since this is plain HTML+script, it works without any client JS.
          </li>
          <li>
            The client hydrates against the completed DOM. The serialized data inside <code>window.__DATA__</code> is already-resolved Promises,
            so <code>use()</code> reads them synchronously and hydration matches without any refetch.
          </li>
        </ol>
        <p className="dim">
          Note: <code>onShellReady</code> = "send as soon as it's displayable", <code>onAllReady</code> = "everything complete" (used for crawlers or pre-rendering).
          In edge/fetch-based runtimes you use <code>renderToReadableStream</code>, which is the same idea with Web Streams instead of Node streams.
        </p>
      </div>
    </section>
  )
}
