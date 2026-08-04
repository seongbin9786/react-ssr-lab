import { Suspense, useEffect, use, useState } from 'react'
import type { RequestDb } from './data'

function Posts({ db }: { db: RequestDb }) {
  const { posts } = use(db.postsPromise)
  return (
    <div className="card">
      <h2>포스트 (0.5초)</h2>
      <ul>
        {posts.map((p) => (
          <li key={p.id}>{p.title}</li>
        ))}
      </ul>
    </div>
  )
}

function Stats({ db }: { db: RequestDb }) {
  const { renderedAt, note } = use(db.statsPromise)
  return (
    <div className="card">
      <h2>통계 (2초)</h2>
      <p>{note}</p>
      <p className="dim">렌더 시각: {renderedAt}</p>
    </div>
  )
}

function Counter() {
  const [count, setCount] = useState(0)
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  return (
    <div className="card">
      <h2>인터랙션</h2>
      <button onClick={() => setCount((c) => c + 1)}>카운트: {count}</button>{' '}
      <span className="dim">{hydrated ? '하이드레이션 완료' : '하이드레이션 전'}</span>
    </div>
  )
}

export function App({ db }: { db: RequestDb }) {
  return (
    <section>
      <h1>Vite 미들웨어 모드 SSR</h1>
      <p className="sub">
        프레임워크 없이 <code>vite.ssrLoadModule</code> + <code>renderToPipeableStream</code>을 직접 조립한 예제
      </p>

      <div className="card">
        <p style={{ margin: 0 }}>
          이 예제의 주인공은 React가 아니라 <strong>Vite가 제공하는 SSR 인프라</strong>다. 개발 모드에서는 서버 엔트리를{' '}
          <code>ssrLoadModule</code>로 로드해서 서버 코드도 HMR이 되고, <code>transformIndexHtml</code>이 클라이언트 번들을
          주입한다. 운영 모드에서는 <code>vite build</code>(클라이언트) + <code>vite build --ssr</code>(서버) 두 개의 번들을
          조합한다. Next.js를 제외한 대부분의 React 메타프레임워크(React Router, TanStack Start, Astro 등)가 이 구조 위에
          라우팅과 데이터 규약을 얹은 것이다.
        </p>
      </div>

      <div className="grid2">
        <Suspense fallback={<div className="skeleton">포스트 로딩 중...</div>}>
          <Posts db={db} />
        </Suspense>
        <Suspense fallback={<div className="skeleton">통계 로딩 중...</div>}>
          <Stats db={db} />
        </Suspense>
      </div>

      <Counter />

      <div className="card">
        <h2>직접 구현(custom)과의 관계</h2>
        <ul>
          <li>렌더링 원리는 custom/L2(스트리밍 SSR)와 동일하다 — <code>renderToPipeableStream</code> + Suspense.</li>
          <li>차이점은 개발자 경험: HMR, TS/JSX 변환, 빌드 파이프라인, 스택 트레이드 교정(<code>ssrFixStacktrace</code>)을 Vite가 담당한다.</li>
          <li>server.js를 열어보면 요청 핸들러가 custom의 <code>src/server.jsx</code>와 거의 같은 모양임을 알 수 있다.</li>
        </ul>
      </div>
    </section>
  )
}
