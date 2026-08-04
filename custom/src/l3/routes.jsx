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
      <h1>L3 - Remix style: router + loader/action</h1>
      <p className="sub">
        The server executes the <code>loader</code>s of the matched routes in parallel, embeds the data in the HTML, and mutations go through <code>action</code>s (form POST). After hydration, it switches to SPA navigation.
      </p>
      <div className="grid2">
        <aside className="card">
          <h2>
            Inbox
            {layoutData.unread > 0 && <span className="badge">{layoutData.unread} unread</span>}
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
            This list is the result of the layout's <code>loader</code> running on the server.
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
      <h2>Summary</h2>
      <table>
        <tbody>
          <tr><th>Total mail count</th><td>{data.stats.total}</td></tr>
          <tr><th>Unread</th><td>{data.stats.unread}</td></tr>
          <tr><th>Most liked</th><td>{data.stats.topSubject}</td></tr>
        </tbody>
      </table>
      <p className="dim">
        When you move to this page, the layout's loader and this page's loader run <strong>in parallel</strong> on the server
        (<code>Promise.all</code>). There's no data waterfall. Click a mail in the left list.
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
  if (!mail) return <p>Mail {params.id} does not exist.</p>
  return (
    <div>
      <h2>{mail.subject}</h2>
      <p className="dim">From {mail.from} · params.id = {params.id}</p>
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
        <button>👍 Like {mail.likes}</button>{' '}
        <span className="dim">Try disabling JS — the form still works</span>
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
