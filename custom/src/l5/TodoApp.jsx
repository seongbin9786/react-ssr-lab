import { useEffect, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// L5의 컴포넌트는 전부 클라이언트 컴포넌트다.
// 서버는 렌더링을 "해주는" 존재일 뿐(심지어 그것도 옵션), 데이터와 mutation은
// 서버 함수 RPC로 가져온다.
// ---------------------------------------------------------------------------

async function callServerFn(name, args) {
  const res = await fetch('/l5/__rpc', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, args }),
  })
  const json = await res.json()
  if (!json.ok) throw new Error(json.error)
  return json.result
}

export function TodoApp({ initial, renderedAt }) {
  const [todos, setTodos] = useState(initial.todos)
  const [hydrated, setHydrated] = useState(false)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => setHydrated(true), [])

  async function handleAdd(e) {
    e.preventDefault()
    const text = inputRef.current?.value.trim()
    if (!text || busy) return
    setBusy(true)
    try {
      const { todo } = await callServerFn('addTodo', { text })
      setTodos((list) => [todo, ...list])
      inputRef.current.value = ''
    } finally {
      setBusy(false)
    }
  }

  async function handleToggle(id) {
    const { todo } = await callServerFn('toggleTodo', { id })
    setTodos((list) => list.map((t) => (t.id === id ? todo : t)))
  }

  async function handleRemove(id) {
    await callServerFn('removeTodo', { id })
    setTodos((list) => list.filter((t) => t.id !== id))
  }

  const remaining = todos.filter((t) => !t.done).length

  return (
    <section>
      <h1>L5 - 서버 함수 (TanStack Start 방향)</h1>
      <p className="sub">
        컴포넌트는 전부 클라이언트에 있다. 서버는 <strong>함수</strong>만 노출한다. SSR은 선택적 최적화다.
      </p>

      <div className="card">
        <p style={{ marginTop: 0 }}>
          서버 렌더링 시각: <code>{renderedAt}</code> ·{' '}
          {hydrated ? (
            <strong style={{ color: 'var(--good)' }}>하이드레이션 완료 — 아래 버튼은 전부 RPC 호출이다</strong>
          ) : (
            <span className="dim">하이드레이션 전 (폼 제출은 POST로 여전히 동작)</span>
          )}
        </p>

        {/* JS가 없어도 이 form은 action="/l5/add"로 POST되어 동작한다 (progressive enhancement) */}
        <form method="post" action="/l5/add" onSubmit={handleAdd}>
          <input ref={inputRef} name="text" placeholder="todo를 입력하고 Enter" style={{ width: '60%' }} />{' '}
          <button className="primary" disabled={busy}>추가</button>
        </form>

        <ul style={{ listStyle: 'none', padding: 0, marginTop: 14 }}>
          {todos.map((todo) => (
            <li key={todo.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0' }}>
              <button onClick={() => handleToggle(todo.id)} style={{ padding: '2px 8px' }}>
                {todo.done ? '✅' : '⬜'}
              </button>
              <span style={{ flex: 1, textDecoration: todo.done ? 'line-through' : 'none' }}>{todo.text}</span>
              <button onClick={() => handleRemove(todo.id)} style={{ padding: '2px 8px' }}>✕</button>
            </li>
          ))}
        </ul>
        <p className="dim">{remaining}개 남음 · 체크/×/추가 모두 POST /l5/__rpc 호출이다</p>
      </div>

      <div className="card">
        <h2>동작 원리</h2>
        <ol>
          <li>
            <strong>서버 함수</strong>: <code>listTodos</code>, <code>addTodo</code>, <code>toggleTodo</code>, <code>removeTodo</code>는 서버 번들에만 존재한다.
            클라이언트는 <code>{'callServerFn("addTodo", args)'}</code> 형태로 호출한다 — 이름과 인자가 경계를 건너고, 결과는 직렬화되어 돌아온다.
          </li>
          <li>
            <strong>SSR</strong>: 첫 요청 때만 서버가 <code>listTodos()</code>를 직접 호출해 결과를 HTML에 싣는다. 그 이후에는 클라이언트가 모든 상태를 소유하고 서버는 렌더링하지 않는다.
          </li>
          <li>
            <strong>점진적 향상</strong>: 추가 폼은 실제 <code>&lt;form method="post"&gt;</code>이기도 해서, 서버가 POST <code>/l5/add</code>를 처리하고 리다이렉트한다. JS 없이도 동작한다.
          </li>
        </ol>
      </div>

      <div className="card">
        <h2>L4와 차이 (두 프레임워크가 선택한 방향)</h2>
        <table>
          <thead>
            <tr><th></th><th>L4 / Next (RSC)</th><th>L5 / TanStack Start (서버 함수)</th></tr>
          </thead>
          <tbody>
            <tr><td>경계를 건너는 것</td><td>컴포넌트 실행 결과 (트리)</td><td>함수 인자 / 반환값</td></tr>
            <tr><td>경계의 단위</td><td>컴포넌트</td><td>함수</td></tr>
            <tr><td>컴포넌트의 거처</td><td>서버 기본, 클라이언트는 예외</td><td>전부 클라이언트</td></tr>
            <tr><td>상태 소유</td><td>서버가 트리를 다시 렌더링해 스트리밍</td><td>클라이언트 상태 + 캐시가 진실의 원천</td></tr>
            <tr><td>SSR의 지위</td><td>아키텍처의 중심</td><td>옵션 (SPA 우선)</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}
