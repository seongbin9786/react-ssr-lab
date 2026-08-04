import { Link, useRouter } from './router-context.jsx'
import { listMails, getMail, countUnread, likeMail } from './db.js'

// ---------------------------------------------------------------------------
// 레이아웃: 모든 라우트가 공유하는 껍데기 (Remix의 root route + 중첩 라우트)
// layoutLoader의 결과는 layoutData로 들어온다
// ---------------------------------------------------------------------------
export function InboxLayout({ layoutData, children }) {
  const { pending } = useRouter()
  return (
    <section>
      <h1>L3 - Remix 스타일: 라우터 + loader/action</h1>
      <p className="sub">
        서버가 매칭된 라우트의 <code>loader</code>들을 병렬로 실행해 데이터를 HTML에 싣고, mutation은 <code>action</code>(폼 POST)으로 일어난다. 하이드레이션 이후에는 SPA 내비게이션으로 전환된다.
      </p>
      <div className="grid2">
        <aside className="card">
          <h2>
            받은메일함
            {layoutData.unread > 0 && <span className="badge">{layoutData.unread} 읽지 않음</span>}
          </h2>
          <div className="maillist">
            {layoutData.mails.map((m) => (
              <Link key={m.id} to={`/l3/mail/${m.id}`}>
                <span className="from">{m.unread ? '● ' : ''}{m.from}</span>
                <div className="dim" style={{ fontSize: 13 }}>{m.subject}</div>
              </Link>
            ))}
          </div>
          <p className="dim" style={{ marginTop: 12, fontSize: 13 }}>
            이 목록은 레이아웃의 <code>loader</code>가 서버에서 실행된 결과다.
          </p>
        </aside>
        <div className={`card${pending ? ' pending' : ''}`}>{children}</div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 인덱스 라우트: /l3
// ---------------------------------------------------------------------------
export function InboxIndex({ data }) {
  return (
    <div>
      <h2>요약</h2>
      <table>
        <tbody>
          <tr><th>전체 메일 수</th><td>{data.stats.total}</td></tr>
          <tr><th>읽지 않음</th><td>{data.stats.unread}</td></tr>
          <tr><th>가장 많은 좋아요</th><td>{data.stats.topSubject}</td></tr>
        </tbody>
      </table>
      <p className="dim">
        이 페이지로 이동하면 레이아웃 loader와 이 페이지의 loader가 서버에서 <strong>병렬로</strong> 실행된다
        (<code>Promise.all</code>). 데이터 워터폴이 없다. 왼쪽 목록에서 메일을 클릭해보자.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 상세 라우트: /l3/mail/:id
// ---------------------------------------------------------------------------
export function MailDetail({ data, params }) {
  const { navigate } = useRouter()
  const mail = data.mail
  if (!mail) return <p>{params.id}번 메일이 없습니다.</p>
  return (
    <div>
      <h2>{mail.subject}</h2>
      <p className="dim">보낸 사람 {mail.from} · params.id = {params.id}</p>
      <p>{mail.body}</p>
      {/*
        핵심: mutation이 <form method="post">로 일어난다.
        - JS가 없으면: 브라우저가 이 form을 그대로 POST → 서버 action 실행 → 303 redirect
        - JS가 있으면: onSubmit에서 막고 fetch POST(?_data)로 보내고, 응답 payload로 상태만 갱신
      */}
      <form
        method="post"
        action={`/l3/mail/${mail.id}`}
        onSubmit={(e) => {
          e.preventDefault()
          navigate(`/l3/mail/${mail.id}`, { method: 'POST' })
        }}
      >
        <button>👍 좋아요 {mail.likes}</button>{' '}
        <span className="dim">JS를 비활성화해도 — 폼은 그대로 동작한다</span>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 라우트 테이블
// ---------------------------------------------------------------------------
const mailLayoutLoader = async () => ({ mails: listMails(), unread: countUnread() })

export const routes = [
  {
    id: 'index',
    path: '/l3',
    Layout: InboxLayout,
    layoutLoader: mailLayoutLoader,
    Component: InboxIndex,
    loader: async () => {
      const mails = listMails()
      const liked = [...mails].sort((a, b) => (getMail(b.id)?.likes ?? 0) - (getMail(a.id)?.likes ?? 0))
      return {
        stats: {
          total: mails.length,
          unread: countUnread(),
          topSubject: liked[0]?.subject ?? '-',
        },
      }
    },
  },
  {
    id: 'mail',
    path: '/l3/mail/:id',
    Layout: InboxLayout,
    layoutLoader: mailLayoutLoader,
    Component: MailDetail,
    loader: async ({ params }) => ({ mail: getMail(params.id) }),
    // action: POST 요청을 처리. 여기서는 좋아요 + 읽음 처리
    action: async ({ params }) => {
      likeMail(params.id)
      return null
    },
  },
]

export const routeById = Object.fromEntries(routes.map((r) => [r.id, r]))
