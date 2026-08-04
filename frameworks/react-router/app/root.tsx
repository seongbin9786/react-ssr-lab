import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteError } from 'react-router'

const css = `
:root{color-scheme:dark;--bg:#0b0e14;--panel:#131824;--border:#242c3d;--text:#e8ebf2;--dim:#98a2b6;--accent:#82aaff;--good:#9ece6a}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.65 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",sans-serif}
main{max-width:860px;margin:0 auto;padding:36px 20px 80px}
h1{font-size:26px;margin:0 0 4px}h2{font-size:17px;margin:0 0 10px}
.sub{color:var(--dim);margin:0 0 22px}
.card{background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:18px 20px;margin:14px 0}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:720px){.grid2{grid-template-columns:1fr}}
button{font:inherit;background:#1c2436;color:var(--text);border:1px solid var(--border);border-radius:10px;padding:8px 14px;cursor:pointer}
button:hover{border-color:var(--accent)}
code{background:#1a2130;border:1px solid var(--border);border-radius:6px;padding:1px 6px;font-size:13px;font-family:ui-monospace,Menlo,monospace}
ul{padding-left:20px}li{margin:4px 0}
.dim{color:var(--dim)}
.maillist{display:flex;flex-direction:column;gap:6px}
.maillist a{display:block;padding:8px 12px;border-radius:10px;border:1px solid var(--border);color:var(--text);text-decoration:none}
.maillist a:hover{border-color:var(--accent)}
.badge{display:inline-block;font-size:12px;color:#c3a6ff;border:1px solid var(--border);border-radius:999px;padding:1px 9px;margin-left:6px}
`

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>React Router 7 프레임워크 모드</title>
        <Meta />
        <Links />
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  return <Outlet />
}

// loader에서 throw한 Response는 여기서 에러 화면으로 렌더링된다
export function ErrorBoundary() {
  const error = useRouteError()
  const status = isRouteErrorResponse(error) ? error.status : 500
  return (
    <main>
      <div className="card">
        <h1>{status}</h1>
        <p className="dim">{isRouteErrorResponse(error) ? error.statusText : String(error)}</p>
      </div>
    </main>
  )
}
