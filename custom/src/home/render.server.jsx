import { renderToString } from 'react-dom/server'
import { chromeTop, chromeBottom } from '../shared/chrome.js'

const LEVELS = [
  {
    href: '/l1',
    title: 'L1 - 기본 SSR',
    desc: '가장 기본적인 형태. renderToString이 React 트리를 문자열로 만들고, hydrateRoot가 클라이언트에서 이벤트를 연결한다. SSR이 왜 필요한지, 하이드레이션의 구조를 본다.',
  },
  {
    href: '/l2',
    title: 'L2 - 스트리밍 SSR',
    desc: 'renderToPipeableStream + Suspense. 셸을 먼저 보내고 느린 콘텐츠는 나중에 끼워 넣는다. L1에서 전체 응답이 막히는 문제를 푸는 기법이다.',
  },
  {
    href: '/l3',
    title: 'L3 - Remix 스타일 (라우터 + loader/action)',
    desc: '라우터를 중심에 두는 모델. loader가 데이터를 병렬로 가져오고, mutation은 action으로 일어나며, 모든 것은 HTML 폼에서 시작한다. 하이드레이션 이후에는 SPA가 된다.',
  },
  {
    href: '/l4',
    title: 'L4 - 서버 컴포넌트 (Next 방향)',
    desc: '서버가 HTML이 아니라 컴포넌트 트리 자체(flight 프로토콜)를 보낸다. 서버 컴포넌트는 JS를 0바이트 보내고, 클라이언트 컴포넌트만 클라이언트에서 하이드레이션된다. 미니 RSC를 구현했다.',
  },
  {
    href: '/l5',
    title: 'L5 - 서버 함수 (TanStack Start 방향)',
    desc: '정반대 방향. 컴포넌트는 전부 클라이언트에 두고, 서버는 함수만 노출한다(RPC). SSR은 아키텍처의 중심이 아니라 선택적 최적화가 된다.',
  },
]

function Home() {
  return (
    <section>
      <h1>React SSR Lab</h1>
      <p className="sub">
        React 19 기반으로 렌더러를 기초부터 심화까지 단계별로 구현한 학습 프로젝트. Next.js, Remix(React Router), TanStack Start에서 영감을 받았다.
      </p>

      <div className="card">
        <h2>렌더링 스펙트럼</h2>
        <pre className="wire">
{`CSR (순수 클라이언트 렌더링)
 --> 정적 SSR (renderToString: HTML 생성)
 --> 스트리밍 SSR (Suspense + 셸 먼저 전송)
 --> SSR + 데이터 프로토콜 (Remix: loader/action)
 --> 서버 우선 컴포넌트 (Next RSC: 서버가 컴포넌트를 소유)
 --> 클라이언트 우선 + 서버 함수 (TanStack Start: RPC)`}
        </pre>
        <p className="dim">
          오른쪽으로 갈수록 "컴포넌트가 어디서 실행되고, 경계는 어디인가"라는 질문의 답이 달라진다. L1~L3은 컴포넌트 코드가 양쪽에 다 있고, L4는 컴포넌트 자체가 서버/클라이언트로 나뉘며, L5는 함수가 나뉜다.
        </p>
      </div>

      {LEVELS.map((level) => (
        <a key={level.href} href={level.href} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
          <div className="card">
            <h2>{level.title}</h2>
            <p className="dim" style={{ margin: 0 }}>{level.desc}</p>
          </div>
        </a>
      ))}

      <div className="card">
        <h2>탐색 방법</h2>
        <ul>
          <li>각 페이지에서 페이지 소스를 열어, HTML 안에 무엇이 들어 있는지와 JS가 나중에 무엇을 하는지 비교해보자.</li>
          <li>L2에서는 네트워크 탭을 보면 HTML이 나뉘어 스트리밍되는 것을 확인할 수 있다.</li>
          <li>L4에서는 flight 페이로드(컴포넌트 트리 프로토콜) 원본 보기를 제공한다.</li>
        </ul>
      </div>
    </section>
  )
}

export function renderHome({ res }) {
  res.setHeader('content-type', 'text/html; charset=utf-8')
  res.end(
    chromeTop({ title: '허브', current: '/' }) + renderToString(<Home />) + chromeBottom()
  )
}
