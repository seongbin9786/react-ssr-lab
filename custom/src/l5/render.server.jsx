import { renderToString } from 'react-dom/server'
import { TodoApp } from './TodoApp.jsx'
import { serverFunctions } from './server/functions.js'
import { chromeTop, chromeBottom, embedJson } from '../shared/chrome.js'
import { readBody, sendJson } from '../shared/http.js'

export async function renderL5({ req, res, url }) {
  // RPC 엔드포인트: 클라이언트가 서버 함수를 이름으로 호출한다
  if (req.method === 'POST' && url.pathname === '/l5/__rpc') {
    const { name, args } = JSON.parse(await readBody(req))
    const fn = serverFunctions[name]
    if (!fn) {
      sendJson(res, 404, { ok: false, error: `서버 함수 없음: ${name}` })
      return
    }
    try {
      const result = await fn(args ?? {})
      sendJson(res, 200, { ok: true, result })
    } catch (error) {
      sendJson(res, 400, { ok: false, error: String(error?.message ?? error) })
    }
    return
  }

  // JS 없는 브라우저를 위한 progressive enhancement 경로
  if (req.method === 'POST' && url.pathname === '/l5/add') {
    const form = new URLSearchParams(await readBody(req))
    try {
      await serverFunctions.addTodo({ text: form.get('text') })
    } catch {
      // 빈 텍스트 등 — 데모에서는 무시
    }
    res.statusCode = 303
    res.setHeader('location', '/l5')
    res.end()
    return
  }

  // GET /l5 — SSR. 서버 함수를 서버 "자기가" 직접 호출해서 초기 데이터를 만든다.
  const initial = await serverFunctions.listTodos()
  const renderedAt = new Date().toISOString()

  res.setHeader('content-type', 'text/html; charset=utf-8')
  res.end(
    chromeTop({ title: 'L5 서버 함수', current: '/l5' }) +
      renderToString(<TodoApp initial={initial} renderedAt={renderedAt} />) +
      chromeBottom(
        `<script>window.__DATA__ = ${embedJson({ initial, renderedAt })}</script>` +
          `<script src="/static/l5.js"></script>`
      )
  )
}
