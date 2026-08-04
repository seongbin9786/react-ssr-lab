// .server.ts 접미사: 이 모듈은 서버 전용이며 클라이언트 번들에서 완전히 제거된다.
// 서버 함수의 구현과 상태가 사는 곳.
let nextId = 4
const todos = [
  { id: 1, text: 'TanStack Start 프로젝트 만들기', done: true },
  { id: 2, text: 'createServerFn으로 서버 함수 정의하기', done: true },
  { id: 3, text: 'loader에서 서버 함수 호출하기', done: false },
]

export const db = {
  listTodos() {
    return todos.map((t) => ({ ...t }))
  },
  addTodo(text: string) {
    const todo = { id: nextId++, text: text.slice(0, 140), done: false }
    todos.unshift(todo)
    return todo
  },
  toggleTodo(id: number) {
    const todo = todos.find((t) => t.id === id)
    if (!todo) throw new Error('todo 없음')
    todo.done = !todo.done
    return { ...todo }
  },
}
