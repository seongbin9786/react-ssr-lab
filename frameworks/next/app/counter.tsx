'use client'

// 클라이언트 컴포넌트 — state와 이벤트가 필요한 부분만 'use client'로 분리한다.
import { useState } from 'react'

export function Counter() {
  const [count, setCount] = useState(0)
  return (
    <div className="card">
      <h2>클라이언트 컴포넌트</h2>
      <button onClick={() => setCount((c) => c + 1)}>카운트: {count}</button>{' '}
      <span className="dim">이 파일만 JS 번들에 포함된다</span>
    </div>
  )
}
