// Vite 미들웨어 모드 SSR 서버.
//
// 프레임워크 없이 "번들러 인프라 위에 SSR을 직접 조립한" 모습이다.
// React Router 7(구 Remix)이나 TanStack Start 같은 프레임워크가 내부에서 하는 일이 바로 이것:
//   - 개발 모드: vite.ssrLoadModule로 서버 엔트리를 HMR과 함께 로드
//   - 개발 모드: transformIndexHtml로 index.html에 번들 주입
//   - 운영 모드: vite build로 만든 클라이언트 번들 + 서버 번들 조합
import fs from 'node:fs/promises'
import path from 'node:path'
import http from 'node:http'
import { fileURLToPath } from 'node:url'
import { createServer as createViteServer } from 'vite'

const isProd = process.env.NODE_ENV === 'production'
const root = path.dirname(fileURLToPath(import.meta.url))
const PORT = 3103

async function createServer() {
  const vite = isProd
    ? null
    : await createViteServer({
        root,
        server: { middlewareMode: true },
        appType: 'custom',
      })

  const templatePath = isProd
    ? path.resolve(root, 'dist/client/index.html')
    : path.resolve(root, 'index.html')

  const prodEntry = isProd
    ? await import(path.resolve(root, 'dist/server/entry-server.js'))
    : null

  // 개발 모드에서는 Vite의 connect 미들웨어가 먼저 요청을 받는다.
  // /src/entry-client.tsx, /@vite/client, /@react-refresh 같은 클라이언트 모듈은 Vite가 직접 응답하고,
  // Vite가 처리하지 않은 요청만 next()로 넘어와 아래 SSR 핸들러가 HTML을 렌더링한다.
  // (이 연결이 없으면 브라우저가 요청한 클라이언트 모듈까지 SSR 핸들러가 받아서 하이드레이션이 일어나지 않는다)
  return http.createServer((req, res) => {
    if (vite) vite.middlewares(req, res, () => handleSsr(req, res))
    else handleSsr(req, res)
  })

  async function handleSsr(req, res) {
    try {
      const url = new URL(req.url, 'http://localhost')

      // 운영 모드: 빌드된 클라이언트 자산 서빙
      if (isProd && url.pathname.startsWith('/assets/')) {
        const file = path.resolve(root, 'dist/client', url.pathname.slice(1))
        const data = await fs.readFile(file).catch(() => null)
        if (!data) {
          res.statusCode = 404
          res.end('not found')
          return
        }
        res.setHeader('content-type', 'text/javascript; charset=utf-8')
        res.end(data)
        return
      }

      let template = await fs.readFile(templatePath, 'utf-8')
      if (!isProd) {
        // 개발 모드: HMR 클라이언트 주입 등 Vite가 HTML을 변환
        template = await vite.transformIndexHtml(url.pathname, template)
      }

      const { render } = isProd ? prodEntry : await vite.ssrLoadModule('/src/entry-server.tsx')

      const [head, tail] = template.split('<!--app-html-->')
      res.statusCode = 200
      res.setHeader('content-type', 'text/html; charset=utf-8')
      res.write(head)

      const { stream, data } = render(url.pathname)
      stream.on('data', (chunk) => res.write(chunk))
      stream.on('end', async () => {
        // 스트림이 끝났다는 건 모든 Suspense 데이터가 해결됐다는 뜻.
        // 하이드레이션용 데이터를 직렬화해 클라이언트 번들보다 먼저 보낸다.
        const resolved = await data
        res.write(`<script>window.__DATA__ = ${JSON.stringify(resolved).replaceAll('<', '\\u003c')}</script>`)
        res.write(tail)
        res.end()
      })
      stream.on('error', (err) => {
        console.error(err)
        res.end()
      })
    } catch (err) {
      // 개발 모드에서는 Vite가 스택 트레이드를 소스 위치로 고쳐준다
      if (!isProd && vite) vite.ssrFixStacktrace(err)
      console.error(err)
      if (!res.headersSent) res.statusCode = 500
      res.end(String(err?.stack ?? err))
    }
  }
}

createServer().then((server) => {
  server.listen(PORT, () => {
    console.log(`Vite SSR 예제: http://localhost:${PORT} (${isProd ? 'prod' : 'dev'})`)
  })
})
