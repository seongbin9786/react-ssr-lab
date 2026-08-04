import { renderToString } from 'react-dom/server'
import { App } from './App.jsx'
import { chromeTop, chromeBottom, embedJson } from '../shared/chrome.js'

export function renderL1({ res }) {
  const props = {
    renderedAt: new Date().toISOString(),
    renderedBy: 'server (Node + renderToString)',
  }

  // 여기서 renderToString이 동기적으로 전체 트리를 문자열로 만든다.
  const appHtml = renderToString(<App {...props} />)

  res.setHeader('content-type', 'text/html; charset=utf-8')
  res.end(
    chromeTop({ title: 'L1 basic SSR', current: '/l1' }) +
      appHtml +
      chromeBottom(
        // props를 HTML에 실어 보내야 클라이언트가 "같은 트리"를 다시 렌더링할 수 있다
        `<script>window.__PROPS__ = ${embedJson(props)}</script>` +
          `<script src="/static/l1.js"></script>`
      )
  )
}
