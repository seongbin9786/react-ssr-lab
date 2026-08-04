import { Form, Link, useLoaderData } from 'react-router'
import { getMail, likeMail } from '../db'

export async function loader({ params }: { params: { id: string } }) {
  const mail = getMail(params.id)
  if (!mail) {
    // 웹 표준 Response를 던지면 ErrorBoundary가 404 화면을 그린다
    throw new Response('메일을 찾을 수 없습니다', { status: 404 })
  }
  return { mail }
}

export async function action({ params }: { params: { id: string } }) {
  likeMail(params.id)
  return null
}

export default function MailDetail() {
  const { mail } = useLoaderData<typeof loader>()
  return (
    <main>
      <p>
        <Link to="/">← 받은메일함</Link>
      </p>
      <div className="card">
        <h2>{mail.subject}</h2>
        <p className="dim">
          {mail.from} · params.id = {mail.id}
        </p>
        <p>{mail.body}</p>
        {/* React Router의 Form: JS가 있으면 fetch로 action 호출, 없으면 네이티브 POST */}
        <Form method="post">
          <button>👍 좋아요 {mail.likes}</button>{' '}
          <span className="dim">서버 action 실행 → loader 재실행 → 화면 갱신</span>
        </Form>
      </div>

      <div className="card">
        <h2>custom L3와 같은 점 / 프레임워크가 대신 해주는 것</h2>
        <ul>
          <li>loader 병렬 실행, action 후 자동 revalidation — custom에서는 직접 fetch/setState로 구현했다</li>
          <li>직렬화(single-fetch), 타입 생성(+types), 에러 바운더리, 스크롤 복원이 기본 제공</li>
          <li>
            <code>react-router.config.ts</code>에서 <code>ssr: false</code>로 바꾸면 같은 코드가 그대로 SPA가 된다
          </li>
        </ul>
      </div>
    </main>
  )
}
