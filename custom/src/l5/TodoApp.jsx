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
      <h1>L5 - Server Functions (the TanStack Start direction)</h1>
      <p className="sub">
        All components are on the client side. The server exposes only <strong>functions</strong>. SSR is an optional optimization.
      </p>

      <div className="card">
        <p style={{ marginTop: 0 }}>
          Server rendering time: <code>{renderedAt}</code> ·{' '}
          {hydrated ? (
            <strong style={{ color: 'var(--good)' }}>hydration complete — the button below is an RPC call</strong>
          ) : (
            <span className="dim">before hydration (form submissions still work via POST)</span>
          )}
        </p>

        {/* JS가 없어도 이 form은 action="/l5/add"로 POST되어 동작한다 (progressive enhancement) */}
        <form method="post" action="/l5/add" onSubmit={handleAdd}>
          <input ref={inputRef} name="text" placeholder="Add a todo and press Enter" style={{ width: '60%' }} />{' '}
          <button className="primary" disabled={busy}>Add</button>
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
        <p className="dim">{remaining} remaining · every check/×/add you press is a POST /l5/__rpc call</p>
      </div>

      <div className="card">
        <h2>How it works</h2>
        <ol>
          <li>
            <strong>Server functions</strong>: <code>listTodos</code>, <code>addTodo</code>, <code>toggleTodo</code>, <code>removeTodo</code> exist only inside the server bundle.
            The client calls them in the form <code>{'callServerFn("addTodo", args)'}</code> — the name and arguments cross the boundary, and the result comes back serialized and is returned.
          </li>
          <li>
            <strong>SSR</strong>: on the first request the server calls <code>listTodos()</code> itself and embeds the result in the HTML. From then on, the client owns all state and the server doesn't render at all.
          </li>
          <li>
            <strong>Progressive enhancement</strong>: the add form is also a real <code>&lt;form method="post"&gt;</code>, so the server handles POST <code>/l5/add</code> and redirects. It works even without JS.
          </li>
        </ol>
      </div>

      <div className="card">
        <h2>Difference from L4 (directions the two frameworks chose)</h2>
        <table>
          <thead>
            <tr><th></th><th>L4 / Next (RSC)</th><th>L5 / TanStack Start (server functions)</th></tr>
          </thead>
          <tbody>
            <tr><td>What crosses the boundary</td><td>the component execution result (tree)</td><td>function args / return values</td></tr>
            <tr><td>Unit of the boundary</td><td>component</td><td>function</td></tr>
            <tr><td>Where components live</td><td>server is default, client is the exception</td><td>all on the client</td></tr>
            <tr><td>State ownership</td><td>the server keeps re-rendering and streaming the tree</td><td>client state + cache is the source of truth</td></tr>
            <tr><td>Position of SSR</td><td>the center of the architecture</td><td>optional (SPA-first)</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}
