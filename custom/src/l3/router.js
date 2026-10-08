import { routes } from './routes.jsx'

// :param 패턴을 정규식으로 컴파일
const compiled = routes.map((route) => {
  const keys = []
  const pattern = route.path.replace(/:[^/]+/g, (token) => {
    keys.push(token.slice(1))
    return '([^/]+)'
  })
  return { route, keys, re: new RegExp(`^${pattern}/?$`) }
})

export function matchRoute(pathname) {
  for (const { route, keys, re } of compiled) {
    const m = pathname.match(re)
    if (m) {
      const params = {}
      try {
        keys.forEach((key, i) => {
          params[key] = decodeURIComponent(m[i + 1])
        })
      } catch {
        // /l3/mail/%E0 같은 잘못된 퍼센트 인코딩은 URIError를 던진다 → 매칭 실패(404)로 처리
        return null
      }
      return { route, params }
    }
  }
  return null
}

// 매칭된 라우트의 layoutLoader + loader를 "병렬"로 실행해 payload를 만든다.
// 이 payload가 SSR 때는 HTML에 직렬화되고, 클라이언트 내비게이션 때는 JSON으로 내려간다.
export async function loadPayload(pathname, match) {
  const { route, params } = match
  const ctx = { params }
  const [layoutData, data] = await Promise.all([
    route.layoutLoader(ctx),
    route.loader ? route.loader(ctx) : Promise.resolve(null),
  ])
  return { routeId: route.id, pathname, params, layoutData, data }
}
