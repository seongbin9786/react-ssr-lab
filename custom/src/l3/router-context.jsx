import { createContext, useContext } from 'react'

// 내비게이션 함수를 트리 아래로 흘려보내는 최소 라우터 컨텍스트
export const RouterContext = createContext(null)

export function useRouter() {
  return useContext(RouterContext)
}

export function Link({ to, className, children }) {
  const { navigate } = useRouter()
  return (
    <a
      href={to}
      className={className}
      onClick={(e) => {
        // cmd+클릭 등 새 탭 열기는 브라우저 기본 동작 그대로
        if (e.metaKey || e.ctrlKey || e.shiftKey) return
        e.preventDefault()
        navigate(to)
      }}
    >
      {children}
    </a>
  )
}
