import { renderToString } from 'react-dom/server'
import { App } from './App.jsx'
import { matchRoute, loadPayload } from './router.js'
import { chromeTop, chromeBottom, embedJson } from '../shared/chrome.js'
import { sendJson } from '../shared/http.js'

export async function renderL3({ req, res, url }) {
  const match = matchRoute(url.pathname)
  if (!match) {
    res.statusCode = 404
    res.setHeader('content-type', 'text/plain; charset=utf-8')
    res.end('404: route not found')
    return
  }

  // 클라이언트 내비게이션이 ?_data=1로 요청하면 HTML 대신 JSON을 준다
  const wantsJson = url.searchParams.has('_data')

  // action: form POST(또는 fetch POST)가 들어오면 실행되는 mutation 핸들러
  if (req.method === 'POST') {
    if (match.route.action) await match.route.action({ params: match.params })
    if (!wantsJson) {
      // JS 없는 브라우저: action 후 원래 페이지로 redirect (웹 표준 동작)
      res.statusCode = 303
      res.setHeader('location', url.pathname)
      res.end()
      return
    }
  }

  // layout loader와 route loader를 병렬로 실행
  const payload = await loadPayload(url.pathname, match)

  if (wantsJson) {
    sendJson(res, 200, payload)
    return
  }

  res.setHeader('content-type', 'text/html; charset=utf-8')
  res.end(
    chromeTop({ title: 'L3 Remix style', current: '/l3' }) +
      renderToString(<App initial={payload} />) +
      chromeBottom(
        `<script>window.__PAYLOAD__ = ${embedJson(payload)}</script>` +
          `<script src="/static/l3.js"></script>`
      )
  )
}
