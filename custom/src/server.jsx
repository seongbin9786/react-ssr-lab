import http from 'node:http'
import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { renderHome } from './home/render.server.jsx'
import { renderL1 } from './l1/render.server.jsx'
import { renderL2 } from './l2/render.server.jsx'
import { renderL3 } from './l3/render.server.jsx'
import { renderL4 } from './l4/render.server.jsx'
import { renderL5 } from './l5/render.server.jsx'

const clientDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'client')

const handlers = [
  { match: (p) => p === '/', handle: renderHome },
  { match: (p) => p.startsWith('/l1'), handle: renderL1 },
  { match: (p) => p.startsWith('/l2'), handle: renderL2 },
  { match: (p) => p.startsWith('/l3'), handle: renderL3 },
  { match: (p) => p.startsWith('/l4'), handle: renderL4 },
  { match: (p) => p.startsWith('/l5'), handle: renderL5 },
]

async function serveStatic(res, name) {
  if (name.includes('..')) {
    res.statusCode = 403
    res.end('forbidden')
    return
  }
  try {
    const data = await readFile(path.join(clientDir, name))
    res.setHeader('content-type', 'text/javascript; charset=utf-8')
    res.end(data)
  } catch {
    res.statusCode = 404
    res.end('not found')
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  try {
    if (url.pathname.startsWith('/static/')) {
      await serveStatic(res, url.pathname.slice('/static/'.length))
      return
    }
    for (const { match, handle } of handlers) {
      if (match(url.pathname)) {
        await handle({ req, res, url })
        return
      }
    }
    res.statusCode = 404
    res.setHeader('content-type', 'text/html; charset=utf-8')
    res.end('<h1>404</h1>')
  } catch (err) {
    console.error(err)
    if (!res.headersSent) {
      res.statusCode = 500
      res.setHeader('content-type', 'text/plain; charset=utf-8')
    }
    res.end(String(err?.stack ?? err))
  }
})

const PORT = Number(process.env.PORT ?? 3210)

server.listen(PORT, () => {
  console.log(`React SSR Lab: http://localhost:${PORT}`)
})
