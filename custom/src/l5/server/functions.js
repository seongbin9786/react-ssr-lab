// ---------------------------------------------------------------------------
// 서버 함수 (TanStack Start의 createServerFn 콘셉트를 단순화한 버전)
//
// 이 파일은 서버 번들에만 들어간다. 클라이언트는 이 함수들의 "코드"를 모르고,
// 이름(name)으로 호출하는 RPC 인터페이스만 안다.
//
// L4(RSC)와의 결정적 차이:
//   L4 — 서버가 "컴포넌트 실행 결과"를 보낸다. 경계의 단위는 컴포넌트.
//   L5 — 서버가 "함수"를 노출한다. 경계의 단위는 함수. 컴포넌트는 전부 클라이언트 것.
// ---------------------------------------------------------------------------

let nextId = 4
const todos = [
  { id: 1, text: 'renderToString으로 초기 HTML 만들기', done: true },
  { id: 2, text: 'Suspense 경계로 스트리밍 쪼개기', done: true },
  { id: 3, text: '서버 함수 RPC로 mutation 만들기', done: false },
]

export const serverFunctions = {
  listTodos: async () => {
    return { todos: todos.map((t) => ({ ...t })) }
  },

  addTodo: async ({ text }) => {
    const trimmed = String(text ?? '').trim().slice(0, 140)
    if (!trimmed) throw new Error('빈 텍스트는 추가할 수 없다')
    const todo = { id: nextId++, text: trimmed, done: false }
    todos.unshift(todo)
    return { todo }
  },

  toggleTodo: async ({ id }) => {
    const todo = todos.find((t) => t.id === Number(id))
    if (!todo) throw new Error('todo를 찾을 수 없다')
    todo.done = !todo.done
    return { todo: { ...todo } }
  },

  removeTodo: async ({ id }) => {
    const index = todos.findIndex((t) => t.id === Number(id))
    if (index === -1) throw new Error('todo를 찾을 수 없다')
    todos.splice(index, 1)
    return { id: Number(id) }
  },
}
