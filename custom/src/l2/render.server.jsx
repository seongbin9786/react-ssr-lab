import { PassThrough } from 'node:stream'
import { renderToPipeableStream } from 'react-dom/server'
import { App } from './App.jsx'
import { createRequestDb } from './data.js'
import { chromeTop, chromeBottom, embedJson } from '../shared/chrome.js'

export function renderL2({ res }) {
  const db = createRequestDb()

  const { pipe } = renderToPipeableStream(<App db={db} />, {
    onShellReady() {
      // 셸(레이아웃 + Suspense fallback)이 준비된 즉시 응답을 시작한다.
      // 느린 데이터가 아직 남아 있어도 기다리지 않는다 — 이게 스트리밍의 핵심.
      res.statusCode = 200
      res.setHeader('content-type', 'text/html; charset=utf-8')
      res.write(chromeTop({ title: 'L2 스트리밍 SSR', current: '/l2' }))

      // 콘텐츠 스트림을 PassThrough로 받아서, 스트림이 끝난 시점에
      // 직렬화된 데이터 + 클라이언트 번들을 꼬리로 붙인다.
      const passthrough = new PassThrough()
      passthrough.on('data', (chunk) => res.write(chunk))
      passthrough.on('end', async () => {
        const [posts, comments] = await Promise.all([db.postsPromise, db.commentsPromise])
        res.write(
          chromeBottom(
            `<script>window.__DATA__ = ${embedJson({ posts, comments })}</script>` +
              `<script src="/static/l2.js"></script>`
          )
        )
        res.end()
      })
      pipe(passthrough)
    },
    onShellError(error) {
      // 셸 렌더링 자체가 실패한 경우 — 아직 바이트를 안 보냈으니 CSR 폴백 등으로 전환 가능
      console.error(error)
      res.statusCode = 500
      res.setHeader('content-type', 'text/plain; charset=utf-8')
      res.end('shell render failed')
    },
    onError(error) {
      // 셸 이후 스트리밍 중 발생한 에러. 일부 콘텐츠는 이미 나간 상태다.
      console.error(error)
    },
  })
}
