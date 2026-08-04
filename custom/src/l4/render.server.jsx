import { RscHome } from './server-components.jsx'
import { renderFlightToStream } from './flight/server.js'
import { chromeTop, chromeBottom } from '../shared/chrome.js'

export function renderL4({ res, url }) {
  // /l4/flight — RSC 페이로드(컴포넌트 트리)를 NDJSON 스트림으로 반환
  if (url.pathname === '/l4/flight') {
    res.setHeader('content-type', 'application/x-ndjson; charset=utf-8')
    renderFlightToStream(<RscHome />, {
      write: (chunk) => res.write(chunk),
      close: () => res.end(),
    })
    return
  }

  // /l4 — 데모 페이지. 클라이언트가 flight 스트림을 fetch해서 #root를 채운다.
  // (진짜 Next.js는 flight 스트림을 HTML 안에 미리 심어두고 하이드레이션하지만,
  // 여기서는 프로토콜 자체가 잘 보이도록 fetch 방식으로 단순화했다)
  res.setHeader('content-type', 'text/html; charset=utf-8')
  res.end(
    chromeTop({ title: 'L4 Server Components', current: '/l4' }) +
      `<div class="skeleton">RSC 페이로드를 기다리는 중...</div>` +
      chromeBottom(`<script src="/static/l4.js"></script>`)
  )
}
