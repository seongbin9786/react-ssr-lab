import { hydrateRoot } from 'react-dom/client'
import { App } from './App.jsx'

// createRoot(...).render()였다면 #root 안의 서버 HTML을 지우고 새로 그렸을 것이다.
// hydrateRoot는 기존 HTML을 그대로 둔 채 이벤트 리스너만 연결한다.
hydrateRoot(document.getElementById('root'), <App {...window.__PROPS__} />)
