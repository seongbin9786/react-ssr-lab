import './globals.css'

export const metadata = {
  title: 'Next.js App Router 예제',
  description: 'RSC + 스트리밍 + Server Action',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
