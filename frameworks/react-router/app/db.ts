// 서버 메모리의 가짜 메일함 (custom L3과 같은 설정).
// loader/action은 서버에서 실행되므로 DB 접근 코드를 그대로 둘 수 있다.
// (진짜 앱에서는 이 파일이 클라이언트 번들에 새지 않도록 server-only 패키지로 막는다)
const mails = [
  {
    id: 1,
    from: '김리액트',
    subject: 'loader는 언제 실행되나요?',
    unread: true,
    likes: 2,
    body: '첫 요청에서는 서버에서, 하이드레이션 이후 내비게이션에서는 브라우저에서 fetch로 실행된다고 들었어요.',
  },
  {
    id: 2,
    from: '박서버',
    subject: 'action은 폼 POST인가요?',
    unread: true,
    likes: 5,
    body: '네. <Form method="post">가 기본이고, JS가 없어도 네이티브 form submission으로 동작합니다.',
  },
  {
    id: 3,
    from: '최라우터',
    subject: '중첩 라우트 레이아웃 질문',
    unread: false,
    likes: 12,
    body: 'Outlet이 자식 라우트를 끼워넣는 자리입니다. layout route를 쓰면 껍데기를 공유해요.',
  },
]

export function listMails() {
  return mails.map(({ id, from, subject, unread }) => ({ id, from, subject, unread }))
}

export function countUnread() {
  return mails.filter((m) => m.unread).length
}

export function getMail(id: string) {
  return mails.find((m) => m.id === Number(id)) ?? null
}

export function likeMail(id: string) {
  const mail = getMail(id)
  if (!mail) return null
  mail.likes += 1
  mail.unread = false
  return mail
}
