import { useState } from 'react'

// ---------------------------------------------------------------------------
// 클라이언트 컴포넌트들 — 이 파일만 클라이언트 번들에 포함된다.
// 서버는 이 컴포넌트들을 실행하지 않고, 이름 + 직렬화된 props만 보낸다.
// ---------------------------------------------------------------------------

export function Counter() {
  const [count, setCount] = useState(0)
  return (
    <p style={{ margin: 0 }}>
      <button onClick={() => setCount((c) => c + 1)}>클라이언트 카운터: {count}</button>{' '}
      <span className="dim">← state와 이벤트가 필요한 부분만 클라이언트 컴포넌트로</span>
    </p>
  )
}

export function LikeButton({ postId, initialLikes }) {
  const [liked, setLiked] = useState(false)
  const likes = initialLikes + (liked ? 1 : 0)
  return (
    <button onClick={() => setLiked((v) => !v)}>
      {liked ? '💙' : '🤍'} {likes}
    </button>
  )
}

// flight 클라이언트가 $client 행의 이름을 실제 컴포넌트로 해석하는 데 쓰는 레지스트리
export const registry = { Counter, LikeButton }
