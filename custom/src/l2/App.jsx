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
      <h2>게시글 (0.4초)</h2>
      <ul>
        {posts.map((p) => (
          <li key={p.id}>{p.title}</li>
        ))}
      </ul>
      <p className="dim">가져온 시각: {fetchedAt}</p>
    </div>
  )
}

function CommentList({ db }) {
  const { comments, fetchedAt } = use(db.commentsPromise)
  return (
    <div className="card">
      <h2>댓글 (2.5초)</h2>
      <ul>
        {comments.map((c) => (
          <li key={c.id}>
            <strong>{c.author}</strong>: {c.text}
          </li>
        ))}
      </ul>
      <p className="dim">가져온 시각: {fetchedAt} — 이 청크는 나중에 스트리밍으로 도착했다</p>
    </div>
  )
}

export function App({ db }) {
  return (
    <section>
      <h1>L2 - 스트리밍 SSR</h1>
      <p className="sub">
        <code>renderToPipeableStream</code> + <code>Suspense</code> — 셸을 먼저 보내고, 느린 청크는 나중에 인라인 스크립트로 끼워 넣는다.
      </p>

      <div className="card">
        <p>
          이 페이지의 HTML은 한 번에 도착하지 않았다. 헤더, 내비게이션, 아래 스켈레톤은 <strong>즉시</strong> 전송됐고,
          그 후 데이터 로딩이 끝나면서 실제 콘텐츠가 각각 <strong>400ms</strong>와 <strong>2.5초</strong>에 스트리밍으로 도착해 제자리로 교체됐다.
          네트워크 탭에서 타이밍을 확인해보자 (페이지 소스를 보면 <code>$RC</code> 인라인 스크립트와 <code>&lt;template&gt;</code> 구조도 보인다).
        </p>
      </div>

      <div className="grid2">
        <Suspense fallback={<Skeleton label="게시글" />}>
          <PostList db={db} />
        </Suspense>
        <Suspense fallback={<Skeleton label="댓글" />}>
          <CommentList db={db} />
        </Suspense>
      </div>

      <div className="card">
        <h2>동작 원리</h2>
        <ol>
          <li>
            <code>renderToPipeableStream</code>은 렌더링을 시작하고, <strong>셸</strong>(Suspense 바깥 부분과 모든 fallback)이 준비되는 즉시
            <code>onShellReady</code>를 발생시킨다. 서버는 그 즉시 응답을 파이프하기 시작한다. TTFB는 더 이상 가장 느린 데이터에 볼모로 잡히지 않는다.
          </li>
          <li>
            일시 중단된 경계는 fallback과 <code>&lt;template id="B:0"&gt;</code> 표식으로 먼저 전송된다. Promise가 해결되면 React가 실제 콘텐츠를
            <code>&lt;div hidden id="S:0"&gt;</code>에 담아 플러시하고, 작은 인라인 스크립트(<code>$RC</code>)가 DOM에서 fallback을 그 콘텐츠로 교체한다. 순수 HTML+스크립트라 클라이언트 JS 없이도 동작한다.
          </li>
          <li>
            클라이언트는 완성된 DOM에 대해 하이드레이션한다. <code>window.__DATA__</code> 안의 직렬화된 데이터는 이미 해결된 Promise라서,
            <code>use()</code>가 이를 동기적으로 읽고 재fetch 없이 하이드레이션이 일치한다.
          </li>
        </ol>
        <p className="dim">
          참고: <code>onShellReady</code> = "표시할 수 있는 만큼 즉시 보내기", <code>onAllReady</code> = "전부 완성 후 보내기"(크롤러나 사전 렌더링용).
          edge/fetch 기반 런타임에서는 Node 스트림 대신 Web Streams를 쓰는 <code>renderToReadableStream</code>을 사용한다.
        </p>
      </div>
    </section>
  )
}
