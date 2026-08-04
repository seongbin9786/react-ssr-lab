import { useCallback, useEffect, useState } from 'react'
import { RouterContext } from './router-context.jsx'
import { routeById } from './routes.jsx'

// initial: 서버가 만들어준 { routeId, pathname, params, layoutData, data }
// SSR 첫 렌더는 이걸로 하고, 이후 내비게이션은 fetch로 payload를 받아 state를 교체한다.
export function App({ initial }) {
  const [state, setState] = useState(initial)
  const [pending, setPending] = useState(false)

  const navigate = useCallback(async (to, options = {}) => {
    setPending(true)
    try {
      const sep = to.includes('?') ? '&' : '?'
      // ?_data=1: 서버가 HTML 대신 loader 결과 JSON을 돌려주는 분기
      const res = await fetch(`${to}${sep}_data=1`, options.method ? { method: options.method } : undefined)
      const payload = await res.json()
      setState(payload)
      if (!options.replace && payload.pathname !== location.pathname) {
        history.pushState(null, '', payload.pathname)
      }
    } finally {
      setPending(false)
    }
  }, [])

  useEffect(() => {
    const onPop = () => navigate(location.pathname, { replace: true })
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [navigate])

  const route = routeById[state.routeId]
  const Layout = route.Layout
  const Screen = route.Component

  return (
    <RouterContext.Provider value={{ navigate, pending }}>
      <Layout layoutData={state.layoutData}>
        <Screen data={state.data} params={state.params} />
      </Layout>
    </RouterContext.Provider>
  )
}
