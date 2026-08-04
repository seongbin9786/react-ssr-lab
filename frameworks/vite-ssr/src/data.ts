const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function createRequestDb() {
  return {
    postsPromise: delay(500).then(() => ({
      posts: [
        { id: 1, title: 'Vite는 SSR 런타임이 아니라 번들러 인프라다' },
        { id: 2, title: 'ssrLoadModule: 서버 코드를 HMR과 함께 로드' },
        { id: 3, title: 'transformIndexHtml: 개발 모드 번들 주입' },
      ],
    })),
    statsPromise: delay(2000).then(() => ({
      renderedAt: new Date().toISOString(),
      note: '이 카드는 2초 지연 후 스트리밍으로 도착했다',
    })),
  }
}

export type RequestDb = ReturnType<typeof createRequestDb>
