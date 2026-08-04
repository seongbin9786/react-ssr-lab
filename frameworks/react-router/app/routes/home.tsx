import { Link, useLoaderData } from 'react-router'
import { countUnread, listMails } from '../db'

export async function loader() {
  return { mails: listMails(), unread: countUnread() }
}

export default function Home() {
  const { mails, unread } = useLoaderData<typeof loader>()
  return (
    <main>
      <h1>React Router 7 프레임워크 모드</h1>
      <p className="sub">구 Remix — loader/action의 공식 구현. custom L3와 같은 모델을 프레임워크가 제공합니다.</p>

      <div className="card">
        <p style={{ margin: 0 }}>
          이 페이지의 데이터는 라우트 모듈의 <code>loader</code>가 만들었다. 첫 요청에서는 <strong>서버</strong>에서 실행되고
          그 결과가 HTML과 함께 직렬화되어 내려온다. 아래 메일을 클릭하면 하이드레이션 이후의{' '}
          <strong>클라이언트 내비게이션</strong> — 이번엔 loader가 브라우저에서 fetch로 실행된다. Network 탭에서{' '}
          <code>?_data</code> 스타일의 응답 대신 single-fetch 스트림을 볼 수 있다.
        </p>
      </div>

      <div className="card">
        <h2>
          받은메일함{unread > 0 && <span className="badge">{unread} 읽지 않음</span>}
        </h2>
        <div className="maillist">
          {mails.map((m) => (
            <Link key={m.id} to={`/mail/${m.id}`}>
              <strong>{m.unread ? '● ' : ''}{m.from}</strong>
              <div className="dim" style={{ fontSize: 13 }}>{m.subject}</div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
