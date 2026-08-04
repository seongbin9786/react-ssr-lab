import { hydrateRoot } from 'react-dom/client'
import { App } from './App.jsx'

// 서버가 직렬화해준 loader 데이터로 하이드레이션.
// 이후부터는 Link 클릭 → fetch(?_data) → setState로 SPA처럼 동작한다.
hydrateRoot(document.getElementById('root'), <App initial={window.__PAYLOAD__} />)
