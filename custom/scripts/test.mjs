// 빌드 → 서버 기동 → 클라이언트 검증 → 정리. `npm test`의 본체.
import { spawn, execSync } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const root = new URL('..', import.meta.url).pathname

console.log('== build ==')
execSync('node build.mjs', { cwd: root, stdio: 'inherit' })

console.log('== start server ==')
const server = spawn('node', ['dist/server.mjs'], { cwd: root, stdio: 'inherit' })

let up = false
for (let i = 0; i < 30; i++) {
  await sleep(200)
  try {
    const res = await fetch('http://localhost:3210/')
    if (res.ok) {
      up = true
      break
    }
  } catch {
    // 아직 기동 전
  }
}
if (!up) {
  console.error('서버가 올라오지 않았다 (포트 3210이 이미 사용 중일 수 있음)')
  server.kill()
  process.exit(1)
}

let code = 0
try {
  console.log('== client checks ==')
  execSync('node scripts/client-check.mjs', { cwd: root, stdio: 'inherit' })
} catch {
  code = 1
} finally {
  server.kill()
}
process.exit(code)
