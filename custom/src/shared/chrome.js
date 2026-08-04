// 모든 페이지가 공유하는 HTML 껍데기(크롬).
// React 트리는 <main id="root"> 안쪽만 담당하고, nav/스타일/부트 스크립트는
// 템플릿 문자열로 직접 작성한다. (실제 프레임워크도 document 껍데기를 이렇게 관리한다)

export const CSS = `
:root{color-scheme:dark;--bg:#0b0e14;--panel:#131824;--border:#242c3d;--text:#e8ebf2;--dim:#98a2b6;--accent:#82aaff;--accent2:#c3a6ff;--good:#9ece6a}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.65 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Pretendard",sans-serif}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
nav.top{position:sticky;top:0;z-index:10;display:flex;gap:6px;flex-wrap:wrap;align-items:center;padding:10px 20px;background:rgba(11,14,20,.88);backdrop-filter:blur(8px);border-bottom:1px solid var(--border)}
nav.top .brand{font-weight:700;margin-right:10px}
nav.top a{padding:4px 10px;border-radius:999px;color:var(--dim);font-size:13px;border:1px solid transparent}
nav.top a.active{background:var(--panel);color:var(--text);border-color:var(--border)}
main{max-width:940px;margin:0 auto;padding:36px 20px 80px}
h1{font-size:26px;margin:0 0 4px}h2{font-size:17px;margin:0 0 10px}h3{font-size:15px;margin:14px 0 6px}
.sub{color:var(--dim);margin:0 0 22px}
.card{background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:18px 20px;margin:14px 0}
.card.pending{opacity:.55;transition:opacity .15s}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:720px){.grid2{grid-template-columns:1fr}}
button{font:inherit;background:#1c2436;color:var(--text);border:1px solid var(--border);border-radius:10px;padding:8px 14px;cursor:pointer}
button:hover{border-color:var(--accent)}
button:disabled{opacity:.5;cursor:default}
button.primary{background:var(--accent);border-color:var(--accent);color:#0b0e14;font-weight:600}
input{font:inherit;background:#0e1219;border:1px solid var(--border);border-radius:10px;padding:8px 12px;color:var(--text)}
code{background:#1a2130;border:1px solid var(--border);border-radius:6px;padding:1px 6px;font-size:13px;font-family:ui-monospace,Menlo,monospace}
pre.wire{background:#0a0d12;border:1px solid var(--border);border-radius:10px;padding:12px;overflow-x:auto;font-size:12px;line-height:1.55;white-space:pre-wrap;word-break:break-all}
.skeleton{border-radius:12px;background:linear-gradient(100deg,#161c28 40%,#1f2838 50%,#161c28 60%);background-size:200% 100%;animation:sh 1.1s infinite linear;color:var(--dim);padding:26px;text-align:center;margin:14px 0}
@keyframes sh{to{background-position:-200% 0}}
ul{padding-left:20px;margin:8px 0}li{margin:4px 0}
table{border-collapse:collapse;width:100%;margin:10px 0}td,th{border:1px solid var(--border);padding:6px 10px;text-align:left;font-size:14px}th{background:#161c28}
.badge{display:inline-block;font-size:12px;color:var(--accent2);border:1px solid var(--border);border-radius:999px;padding:1px 9px;margin-left:6px;vertical-align:middle}
.dim{color:var(--dim)}
.maillist{display:flex;flex-direction:column;gap:6px}
.maillist a{display:block;padding:8px 12px;border-radius:10px;border:1px solid var(--border);color:var(--text)}
.maillist a.active{border-color:var(--accent)}
.maillist a .from{font-weight:600}
footer{max-width:940px;margin:0 auto;padding:0 20px 40px;color:var(--dim);font-size:13px}
`.trim()

const LEVELS = [
  ['/', '허브'],
  ['/l1', 'L1 기본 SSR'],
  ['/l2', 'L2 스트리밍'],
  ['/l3', 'L3 Remix 스타일'],
  ['/l4', 'L4 서버 컴포넌트'],
  ['/l5', 'L5 서버 함수'],
]

export function chromeTop({ title, current }) {
  const links = LEVELS.map(([href, label]) => {
    const cls = href === current ? ' class="active"' : ''
    return `<a href="${href}"${cls}>${label}</a>`
  }).join('')
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} - React SSR Lab</title>
<style>${CSS}</style>
</head>
<body>
<nav class="top"><span class="brand">React SSR Lab</span>${links}</nav>
<main id="root">`
}

export function chromeBottom(boot = '') {
  return `</main>
<footer>React 19 SSR 학습 프로젝트 - 각 레벨의 페이지 소스를 확인해보세요 (cmd+option+u).</footer>
${boot}
</body>
</html>`
}

// JSON을 <script> 안에 안전하게 embed할 때 </script> 탈출을 방지
export function embedJson(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c')
}
