// 서버 메모리에만 존재하는 가짜 메일함.
// 서버 프로세스가 살아 있는 동안 mutation(좋아요)이 유지된다.
const mails = [
  {
    id: 1,
    from: '김리액트',
    subject: 'streaming SSR 질문 있어요',
    unread: true,
    likes: 2,
    body: 'renderToPipeableStream에서 onShellReady랑 onAllReady 차이가 뭔가요? 크롤러한테는 뭘 써야 하나요?',
  },
  {
    id: 2,
    from: '박서버',
    subject: 'loader는 어디서 실행되나요?',
    unread: true,
    likes: 5,
    body: 'Remix loader는 서버에서 돌고, 하이드레이션 이후 내비게이션에서는 클라이언트가 fetch로 실행한다고 들었어요. 데이터가 직렬화돼서 HTML에 같이 내려오는 거 맞죠?',
  },
  {
    id: 3,
    from: '최하이드',
    subject: 'hydration mismatch 고쳤습니다',
    unread: false,
    likes: 12,
    body: 'Date.now()를 렌더 중에 바로 찍어서 서버/클라이언트 결과가 달랐어요. 서버에서 만든 값을 props로 직렬화해서 넘기니까 해결됐습니다.',
  },
  {
    id: 4,
    from: '이플라이트',
    subject: 'RSC 페이로드 구경하세요',
    unread: false,
    likes: 7,
    body: 'L4에 가면 서버 컴포넌트 트리가 JSON 줄로 스트리밍되는 걸 볼 수 있어요. HTML이 아니라 "컴포넌트 트리"가 날아간다는 게 포인트입니다.',
  },
]

export function listMails() {
  return mails.map(({ id, from, subject, unread }) => ({ id, from, subject, unread }))
}

export function getMail(id) {
  return mails.find((m) => m.id === Number(id)) ?? null
}

export function countUnread() {
  return mails.filter((m) => m.unread).length
}

export function likeMail(id) {
  const mail = getMail(id)
  if (!mail) return null
  mail.likes += 1
  mail.unread = false
  return mail
}
