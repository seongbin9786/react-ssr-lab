import { Suspense } from 'react'
import { revalidatePath } from 'next/cache'
import { Counter } from './counter'
import { SlowPosts, TeamNote } from './posts'

export const dynamic = 'force-dynamic'

// 데모용 서버 메모리 — 서버 액션이 이걸 바꾸고 revalidatePath로 페이지를 갱신한다
let likes = 3

async function like() {
  'use server'
  likes += 1
  revalidatePath('/')
}

export default function Page() {
  return (
    <main>
      <h1>Next.js App Router</h1>
      <p className="sub">RSC + 스트리밍 + Server Action — custom L2/L4가 재현했던 것의 공식 구현</p>

      <div className="card">
        <p style={{ margin: 0 }}>
          이 페이지 전체가 <strong>서버 컴포넌트</strong>다. 아래 두 섹션은 Suspense로 감싸져 있어서 셸이 먼저 전송되고,
          2초/3.5초 뒤에 청크가 스트리밍된다 (custom L2와 같은 메커니즘). 좋아요 버튼은 <strong>Server Action</strong> —
          폼 제출이 서버 함수를 호출하고, 서버에서 데이터를 바꾼 뒤 다시 렌더링해서 HTML을 보낸다.
        </p>
      </div>

      <div className="card">
        <h2>Server Action</h2>
        <form action={like}>
          <button>👍 좋아요 {likes}</button>{' '}
          <span className="dim">JS 없이도 동작하는 form POST → 서버에서 likes 증가 → 재렌더링</span>
        </form>
      </div>

      <div className="grid2">
        <Suspense fallback={<div className="skeleton">포스트 스트리밍 중...</div>}>
          <SlowPosts />
        </Suspense>
        <Suspense fallback={<div className="skeleton">팀 메모 스트리밍 중...</div>}>
          <TeamNote />
        </Suspense>
      </div>

      <Counter />

      <div className="card">
        <h2>custom 구현과 대응 관계</h2>
        <ul>
          <li>
            <code>renderToPipeableStream</code> + Suspense → Next의 RSC 스트리밍 (custom L2)
          </li>
          <li>
            서버 컴포넌트 실행 결과를 직렬화해서 전송 → React Flight 프로토콜 (custom L4의 미니 구현이 바로 이 페이로드)
          </li>
          <li>
            <code>'use server'</code> 폼 액션 → custom L3의 action, L5의 서버 함수와 같은 역할
          </li>
          <li>
            페이지 소스에서 <code>self.__next_f.push(...)</code> 부분을 보면 실제 flight 페이로드가 HTML에 내장된 모습을 볼 수
            있다
          </li>
        </ul>
      </div>
    </main>
  )
}
