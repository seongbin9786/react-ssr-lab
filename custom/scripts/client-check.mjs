// 실제 빌드된 클라이언트 번들을 jsdom에서 실행해 하이드레이션/인터랙션을 검증한다.
// 서버(node dist/server.mjs)가 떠 있어야 한다.
import { JSDOM, ResourceLoader } from 'jsdom'

const BASE = 'http://localhost:3210'

class LocalLoader extends ResourceLoader {
  fetch(url, options) {
    return super.fetch(url, options)
  }
}

function makeDom(html, url) {
  const dom = new JSDOM(html, {
    url,
    runScripts: 'dangerously',
    resources: new LocalLoader(),
    pretendToBeVisual: true,
    beforeParse(window) {
      // React 스케줄러 + L4/L5가 브라우저에서 쓰는 API를 주입
      window.MessageChannel = MessageChannel
      window.fetch = (input, init) => fetch(new URL(input, url).href, init)
      window.TextDecoder = TextDecoder
      window.TextEncoder = TextEncoder
      window.requestAnimationFrame ??= (cb) => setTimeout(() => cb(Date.now()), 16)
      window.cancelAnimationFrame ??= clearTimeout
    },
  })
  return dom
}

async function loadPage(path) {
  const res = await fetch(BASE + path)
  const html = await res.text()
  const dom = makeDom(html, BASE + path)
  // 외부 스크립트 로드 + 하이드레이션이 안정될 때까지 대기
  await new Promise((r) => dom.window.addEventListener('load', r))
  await sleep(400)
  return dom
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
function check(name, cond, extra = '') {
  results.push({ name, pass: !!cond, extra })
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`)
}

// --- L1: 하이드레이션 후 버튼 클릭이 state를 바꾸는가 ---
{
  const dom = await loadPage('/l1')
  const doc = dom.window.document
  const btn = [...doc.querySelectorAll('button')].find((b) => b.textContent.includes('카운트'))
  const before = btn.textContent
  btn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
  await sleep(100)
  check('L1 hydration: 클릭으로 카운트 증가', btn.textContent !== before, `${before} -> ${btn.textContent}`)
  check('L1 hydration: 하이드레이션 완료 플래그 전환', doc.body.textContent.includes('하이드레이션 완료'))
}

// --- L2: 스트리밍 데이터가 하이드레이션 후에도 보이는가 ---
{
  const dom = await loadPage('/l2')
  const text = dom.window.document.body.textContent
  check('L2 hydration: posts 렌더', text.includes('renderToString은 왜 블로킹인가'))
  check('L2 hydration: comments 렌더', text.includes('이 섹션은 서버에서 2.5초 걸려서 도착했어요'))
}

// --- L3: 클라이언트 내비게이션(Link 클릭 → fetch → 부분 갱신) ---
{
  const dom = await loadPage('/l3')
  const doc = dom.window.document
  const link = [...doc.querySelectorAll('a')].find((a) => a.getAttribute('href') === '/l3/mail/1')
  link.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
  await sleep(300)
  const text = doc.body.textContent
  check('L3 SPA nav: 상세 화면으로 전환', text.includes('streaming SSR 질문 있어요') && text.includes('김리액트'))
  check('L3 SPA nav: history.pushState 반영', dom.window.location.pathname === '/l3/mail/1', dom.window.location.pathname)
}

// --- L4: flight 스트림을 fetch해서 트리를 조립하는가 ---
{
  const dom = await loadPage('/l4')
  const doc = dom.window.document
  // flight 스트림(1.2s/2.4s 지연)이 모두 도착할 때까지 대기
  await sleep(2800)
  const text = doc.body.textContent
  check('L4 flight: 동기 헤더 조립', text.includes('헤더 (동기 서버 컴포넌트'))
  check('L4 flight: async 포스트 청크 조립', text.includes('서버 컴포넌트는 번들을 줄인다'))
  check('L4 flight: async 팀현황 청크 조립', text.includes('팀 현황 (async 서버 컴포넌트'))
  const counterBtn = [...doc.querySelectorAll('button')].find((b) => b.textContent.includes('클라이언트 카운터'))
  if (counterBtn) {
    counterBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    await sleep(100)
    check('L4 flight: 클라이언트 컴포넌트 인터랙션', counterBtn.textContent.includes('1'), counterBtn.textContent)
  } else {
    check('L4 flight: 클라이언트 컴포넌트 인터랙션', false, 'Counter 버튼을 찾지 못함')
  }
}

// --- L5: RPC로 todo를 추가하는가 ---
{
  const dom = await loadPage('/l5')
  const doc = dom.window.document
  const input = doc.querySelector('input[name="text"]')
  const form = doc.querySelector('form')
  input.value = 'jsdom에서 RPC로 추가'
  form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))
  await sleep(300)
  const text = doc.body.textContent
  check('L5 RPC: addTodo로 목록 갱신', text.includes('jsdom에서 RPC로 추가'))
}

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
