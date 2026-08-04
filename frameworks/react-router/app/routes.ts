import { type RouteConfig, index, route } from '@react-router/dev/routes'

export default [
  index('routes/home.tsx'),
  route('mail/:id', 'routes/mail-detail.tsx'),
] satisfies RouteConfig
