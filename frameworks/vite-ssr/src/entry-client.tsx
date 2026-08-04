import { hydrateRoot } from 'react-dom/client'
import { App } from './App'

// 서버가 스트림 끝에 붙여준 window.__DATA__로 이미 이행된 Promise를 만들어
// 하이드레이션한다 — 재fetch 없음, 서버 HTML과 일치.
const data = (window as any).__DATA__
const db = {
  postsPromise: Promise.resolve(data.posts),
  statsPromise: Promise.resolve(data.stats),
}

hydrateRoot(document.getElementById('root')!, <App db={db} />)
