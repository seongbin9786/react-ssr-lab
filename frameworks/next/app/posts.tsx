// 전부 서버 컴포넌트 — async가 허용되고, 이 파일의 코드는 클라이언트 번들에 들어가지 않는다.
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function SlowPosts() {
  await delay(2000)
  const posts = [
    { id: 1, title: '이 목록은 서버에서 2초 걸려 만들었다' },
    { id: 2, title: '컴포넌트 안에서 직접 데이터를 읽는다 (API 계층 없음)' },
    { id: 3, title: '이 파일의 코드는 브라우저에 한 줄도 안 내려간다' },
  ]
  return (
    <div className="card">
      <h2>포스트 (async 서버 컴포넌트, 2초)</h2>
      <ul>
        {posts.map((p) => (
          <li key={p.id}>{p.title}</li>
        ))}
      </ul>
    </div>
  )
}

export async function TeamNote() {
  await delay(3500)
  return (
    <div className="card">
      <h2>팀 메모 (async 서버 컴포넌트, 3.5초)</h2>
      <p>이 카드가 마지막으로 스트리밍됐다. Network 탭에서 HTML 청크를 확인해보자.</p>
      <p className="dim">렌더 시각: {new Date().toISOString()}</p>
    </div>
  )
}
