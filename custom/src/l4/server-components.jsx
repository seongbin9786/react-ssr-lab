import { clientRef } from './flight/server.js'

// ---------------------------------------------------------------------------
// 서버 컴포넌트들 — 이 파일은 클라이언트 번들에 포함되지 않는다.
// (entry.client.jsx가 이 파일을 import하지 않으므로 esbuild가 아예 안 묶는다)
// 서버에서 실행되고, 결과(직렬화된 트리)만 날아간다.
// ---------------------------------------------------------------------------

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function fetchPosts() {
  await delay(1200)
  return [
    {
      id: 1,
      title: '서버 컴포넌트는 번들을 줄인다',
      excerpt: '이 포스트 카드의 마크업과 데이터는 JS 번들에 한 줄도 안 들어갔다.',
      likes: 4,
    },
    {
      id: 2,
      title: '직렬화가 곧 경계다',
      excerpt: '서버에서 클라이언트로 건널 수 있는 것은 JSON으로 표현 가능한 값뿐이다.',
      likes: 9,
    },
    {
      id: 3,
      title: '데이터 fetching이 컴포넌트 안으로',
      excerpt: '이 목록은 async 서버 컴포넌트가 DB(여기서는 가짜)를 직접 읽어서 만들었다.',
      likes: 2,
    },
  ]
}

async function fetchTeamStats() {
  await delay(2400)
  return { online: 3, note: '이 카드는 2.4초 후에 마지막으로 스트리밍됐다' }
}

async function PostFeed() {
  const posts = await fetchPosts()
  return (
    <div className="card">
      <h2>포스트 (async 서버 컴포넌트, 1.2초)</h2>
      {posts.map((post) => (
        <article key={post.id} style={{ borderBottom: '1px solid var(--border)', padding: '10px 0' }}>
          <h3 style={{ margin: 0 }}>{post.title}</h3>
          <p className="dim" style={{ margin: '4px 0 8px' }}>{post.excerpt}</p>
          {clientRef('LikeButton', { postId: post.id, initialLikes: post.likes })}
        </article>
      ))}
      <p className="dim">
        이 섹션 전체가 서버에서 렌더링됐다. 좋아요 버튼만 클라이언트 컴포넌트($client 참조)다.
      </p>
    </div>
  )
}

async function TeamStats() {
  const stats = await fetchTeamStats()
  return (
    <div className="card">
      <h2>팀 현황 (async 서버 컴포넌트, 2.4초)</h2>
      <p>접속자 {stats.online}명 · {stats.note}</p>
    </div>
  )
}

export function RscHome() {
  return (
    <div>
      <div className="card">
        <h2>헤더 (동기 서버 컴포넌트 — 즉시 도착)</h2>
        <p style={{ margin: '4px 0 10px' }}>
          이 텍스트는 서버 컴포넌트의 출력이다. HTML처럼 보이지만 실제로는
          <code>{" { $element: 'p', props: {...} } "}</code>같은 모델 행이 클라이언트에서 조립된 결과다.
        </p>
        {clientRef('Counter')}
      </div>
      <PostFeed />
      <TeamStats />
    </div>
  )
}
