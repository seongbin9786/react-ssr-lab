import { hydrateRoot } from 'react-dom/client'
import { TodoApp } from './TodoApp.jsx'

// 서버가 listTodos()를 호출해 만들어준 초기 상태로 하이드레이션.
// 그 뒤의 모든 상호작용은 서버 함수 RPC(__rpc)로 일어난다.
hydrateRoot(
  document.getElementById('root'),
  <TodoApp initial={window.__DATA__.initial} renderedAt={window.__DATA__.renderedAt} />
)
