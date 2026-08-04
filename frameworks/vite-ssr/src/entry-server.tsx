import { PassThrough } from 'node:stream'
import { renderToPipeableStream } from 'react-dom/server'
import { App } from './App'
import { createRequestDb } from './data'

// server.js가 부르는 렌더 엔트리. 스트림과 "나중에 직렬화할 데이터"를 돌려준다.
export function render(_url: string) {
  const db = createRequestDb()
  const stream = new PassThrough()

  const { pipe } = renderToPipeableStream(<App db={db} />, {
    onShellReady() {
      pipe(stream)
    },
    onShellError(error) {
      stream.emit('error', error)
    },
    onError(error) {
      console.error(error)
    },
  })

  return {
    stream,
    data: Promise.all([db.postsPromise, db.statsPromise]).then(([posts, stats]) => ({
      posts,
      stats,
    })),
  }
}
