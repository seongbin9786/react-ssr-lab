import { hydrateRoot } from 'react-dom/client'
import { App } from './App.jsx'

// 서버가 HTML 뒤에 붙여준 window.__DATA__로 "이미 이행된 Promise"를 만든다.
// use()는 이행된 Promise를 동기적으로 읽으므로, 하이드레이션 중에
// 다시 suspend되지 않고 서버 HTML과 정확히 일치하는 트리를 만들 수 있다.
// (데이터를 다시 fetch하지 않는다는 뜻이기도 하다)
const db = {
  postsPromise: Promise.resolve(window.__DATA__.posts),
  commentsPromise: Promise.resolve(window.__DATA__.comments),
}

hydrateRoot(document.getElementById('root'), <App db={db} />)
