import { Suspense, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { registry } from './client-components.jsx'
import { createFlightClient } from './flight/client.jsx'

const flight = createFlightClient(registry)
// 스트림을 즉시 시작한다. 행이 도착할 때마다 use()가 깨우면서 트리가 자란다.
flight.connect('/l4/flight')

function App() {
  const [raw, setRaw] = useState(null)
  const [loading, setLoading] = useState(false)

  async function showWireFormat() {
    setLoading(true)
    try {
      setRaw(await (await fetch('/l4/flight')).text())
    } finally {
      setLoading(false)
    }
  }

  return (
    <section>
      <h1>L4 - 서버 컴포넌트 (Next 방향)</h1>
      <p className="sub">
        서버가 HTML이 아니라 <strong>컴포넌트 트리 자체</strong>를 보낸다. 미니 flight 프로토콜로 컴포넌트 트리가 스트리밍된다.
      </p>

      <div className="card">
        <p style={{ marginTop: 0 }}>
          아래 모든 것은 <code>/l4/flight</code> 스트림(JSON 행)에서 조립됐다.
          서버 컴포넌트(헤더, 포스트 목록, 팀 현황)는 브라우저로 <strong>JS를 0바이트</strong> 보낸다 — 직렬화된 실행 결과만 내려온다.
          클라이언트 번들에서 실제 코드인 것은 <code>Counter</code>와 <code>LikeButton</code>뿐이다.
          헤더는 즉시 표시되고, 포스트 목록은 1.2초, 팀 현황은 2.4초에 스트리밍으로 도착한다.
        </p>
        <Suspense fallback={<div className="skeleton">루트 청크를 기다리는 중...</div>}>
          <flight.Root />
        </Suspense>
      </div>

      <div className="card">
        <h2>와이어 포맷(페이로드) 보기</h2>
        <p className="dim" style={{ marginTop: 0 }}>
          실제 프로토콜은 아래처럼 JSON 행일 뿐이다. <code>$element</code>는 서버에서 렌더링된 엘리먼트, <code>$client</code>는 클라이언트 컴포넌트 참조,
          <code>$lazy</code>는 나중에 같은 id의 다른 행이 채워 넣는 스트리밍 슬롯이다.
        </p>
        <button onClick={showWireFormat} disabled={loading}>
          {loading ? '로딩 중...' : raw ? '페이로드 갱신' : '원본 페이로드 보기'}
        </button>
        {raw && <pre className="wire">{raw}</pre>}
      </div>

      <div className="card">
        <h2>진짜 Next.js에 비해 단순화한 것들</h2>
        <ul>
          <li>Next는 flight 스트림을 초기 HTML 안에 스크립트 태그로 심어서 JS 없이도 표시되고 하이드레이션된다. 여기서는 JS 부팅 후에 fetch한다.</li>
          <li>Next는 번들러 플러그인으로 클라이언트 컴포넌트 참조를 실제 모듈 URL로 해석한다. 여기서는 이름 문자열 레지스트리만 쓴다.</li>
          <li>Next는 flight 재요청으로 클라이언트 상태를 유지하면서 트리의 일부만 갱신할 수 있다. 여기서는 초기 스트림만 시연한다.</li>
        </ul>
      </div>
    </section>
  )
}

createRoot(document.getElementById('root')).render(<App />)
