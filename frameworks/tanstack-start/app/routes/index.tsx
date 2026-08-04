import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { db } from '../db.server'

// 서버 함수 정의 — 빌드 시점에 클라이언트 측 호출이 RPC fetch로 변환된다.
// db.server.ts(서버 전용 모듈)에 직접 접근하는 유일한 통로.
const listTodos = createServerFn().handler(async () => {
  return db.listTodos()
})

const addTodo = createServerFn({ method: 'POST' }).handler(async ({ data }: { data: { text: string } }) => {
  return db.addTodo(data.text)
})

const toggleTodo = createServerFn({ method: 'POST' }).handler(async ({ data }: { data: { id: number } }) => {
  return db.toggleTodo(data.id)
})

export const Route = createFileRoute('/')({
  // loader도 결국 서버 함수 호출 — 데이터 로딩과 mutation이 같은 RPC 채널을 쓴다
  loader: async () => await listTodos(),
  component: Home,
})

function Home() {
  const initialTodos = Route.useLoaderData()
  const [todos, setTodos] = useState(initialTodos)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || busy) return
    setBusy(true)
    try {
      const todo = await addTodo({ data: { text: text.trim() } })
      setTodos((list) => [todo, ...list])
      setText('')
    } finally {
      setBusy(false)
    }
  }

  async function handleToggle(id: number) {
    const todo = await toggleTodo({ data: { id } })
    setTodos((list) => list.map((t) => (t.id === id ? todo : t)))
  }

  return (
    <main>
      <h1>TanStack Start</h1>
      <p className="sub">클라이언트 우선 + 서버 함수(createServerFn) — custom L5의 공식 구현 버전</p>

      <div className="card">
        <p style={{ margin: 0 }}>
          첫 화면은 서버가 <code>loader</code>(= 서버 함수 호출) 결과로 SSR해줬다. 하지만 그 이후의 주인은{' '}
          <strong>클라이언트 라우터</strong>다. 아래 추가/체크는 전부 <code>createServerFn</code>이 만든 RPC 호출 —
          함수 <em>이름과 인자</em>가 네트워크를 건너고 결과가 돌아온다. 컴포넌트 코드는 전부 이 번들 안에 있다.
        </p>
      </div>

      <div className="card">
        <form onSubmit={handleAdd}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="todo를 입력하고 Enter"
            style={{ width: '60%' }}
          />{' '}
          <button className="primary" disabled={busy}>
            추가
          </button>
        </form>
        <ul className="todolist">
          {todos.map((todo) => (
            <li key={todo.id}>
              <button onClick={() => handleToggle(todo.id)} style={{ padding: '2px 8px' }}>
                {todo.done ? '✅' : '⬜'}
              </button>
              <span className={todo.done ? 'done' : ''}>{todo.text}</span>
            </li>
          ))}
        </ul>
        <p className="dim">
          {todos.filter((t) => !t.done).length}개 남음 · 모든 조작이 서버 함수 RPC다 (Network 탭에서 <code>/_server</code>
          계열 요청 확인)
        </p>
      </div>

      <div className="card">
        <h2>custom L5와 같은 점 / 프레임워크가 대신 해주는 것</h2>
        <ul>
          <li>custom에서는 <code>/l5/__rpc</code> 엔드포인트와 이름 레지스트리를 손으로 만들었다 — Start는 <code>createServerFn</code> 하나로 빌드 시점에 그걸 생성한다</li>
          <li>인자/반환값 타입이 클라이언트까지 그대로 전달된다 (타입 안전 RPC)</li>
          <li>
            <code>.server.ts</code> 모듈은 클라이언트 번들에서 자동으로 제거된다
          </li>
          <li>SSR은 설정 하나로 끄고 켤 수 있는 옵션 — SPA가 기본 정체성</li>
        </ul>
      </div>
    </main>
  )
}
