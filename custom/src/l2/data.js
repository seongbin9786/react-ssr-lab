const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// 요청마다 새로 만드는 가짜 DB. Promise 기반으로,
// 컴포넌트는 use(promise)로 이 데이터를 읽는다.
export function createRequestDb() {
  return {
    postsPromise: delay(400).then(() => ({
      fetchedAt: new Date().toISOString(),
      posts: [
        { id: 1, title: 'renderToString은 왜 블로킹인가' },
        { id: 2, title: 'Suspense는 서버에서도 동작한다' },
        { id: 3, title: '셸을 먼저 보내라는 말의 의미' },
      ],
    })),
    commentsPromise: delay(2500).then(() => ({
      fetchedAt: new Date().toISOString(),
      comments: [
        { id: 1, author: '김서버', text: '이 섹션은 서버에서 2.5초 걸려서 도착했어요' },
        { id: 2, author: '박스트림', text: 'HTML이 도착한 뒤에 뒤늦게 끼워넣어진 겁니다' },
        { id: 3, author: '최 suspense', text: 'Network 탭에서 이 응답의 타이밍을 확인해보세요' },
      ],
    })),
  }
}
