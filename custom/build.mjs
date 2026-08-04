import * as esbuild from 'esbuild'

const watch = process.argv.includes('--watch')
const levels = ['l1', 'l2', 'l3', 'l4', 'l5']

const base = {
  bundle: true,
  jsx: 'automatic',
  sourcemap: true,
  target: 'es2022',
  logLevel: 'info',
}

const configs = [
  // 서버 번들: 모든 레벨의 서버 렌더러를 하나로 묶음
  {
    ...base,
    entryPoints: ['src/server.jsx'],
    outfile: 'dist/server.mjs',
    platform: 'node',
    format: 'esm',
    // ESM 출력에서 CJS 의존성(react-dom/server)의 require()가 동작하도록
    banner: {
      js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
    },
  },
  // 레벨별 클라이언트 번들 (각 페이지는 자기 번들 하나만 로드)
  ...levels.map((level) => ({
    ...base,
    entryPoints: [`src/${level}/entry.client.jsx`],
    outfile: `dist/client/${level}.js`,
    platform: 'browser',
    format: 'iife',
    define: { 'process.env.NODE_ENV': '"production"' },
  })),
]

if (watch) {
  const contexts = await Promise.all(configs.map((c) => esbuild.context(c)))
  await Promise.all(contexts.map((c) => c.watch()))
  console.log('watching...')
} else {
  await Promise.all(configs.map((c) => esbuild.build(c)))
}
