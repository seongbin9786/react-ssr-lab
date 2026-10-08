# React SSR Lab

React 19 기반 SSR을 **직접 구현**하고, 같은 개념이 **실제 프레임워크**에서 어떻게 구현되어 있는지를 나란히 보는 학습 프로젝트.

```
react-ssr-lab/
├── custom/        ← 프레임워크 없이 React API만으로 렌더러 5종을 직접 구현 (원리 학습)
└── frameworks/    ← 같은 개념을 쓰는 실제 프레임워크 예제 4종
    ├── vite-ssr/         Vite 미들웨어 모드 SSR (프레임워크들의 뼈대)
    ├── next/             Next.js App Router (RSC)
    ├── react-router/     React Router 7 프레임워크 모드 (구 Remix)
    └── tanstack-start/   TanStack Start (서버 함수)
```

## 내부 원리 해설 시리즈 (`docs/`)

SSR·Fiber·스트리밍·하이드레이션·RSC의 내부 동작을 React 본체 수준까지 뜯어 설명하는 글 시리즈.
벤치마킹한 외부 해설글 모음과 각 글에서 가져온 것도 함께 정리했다.

| # | 글 | 핵심 질문 |
|---|---|---|
| 01 | [renderToString은 어떻게 동작하는가](docs/01-render-to-string.md) | 함수 한 번으로 HTML 문자열이 나오는 과정 |
| 02 | [Fiber: 모든 렌더러의 뼈대](docs/02-fiber.md) | 트리를 어떤 자료구조로, 어떤 순서로 처리하는가 |
| 03 | [스트리밍 SSR 해부](docs/03-streaming-ssr.md) | `$RC`/`<template>`/hidden div는 무엇인가 |
| 04 | [하이드레이션](docs/04-hydration.md) | hydrateRoot는 DOM을 다시 만들지 않는다 |
| 05 | [Suspense와 use()의 내부](docs/05-suspense-and-use.md) | Promise를 던진다는 것의 물리적 의미 |
| 06 | [Flight 프로토콜](docs/06-flight.md) | 컴포넌트 트리가 네트워크를 건너는 법 |

시리즈 안내: [docs/README.md](docs/README.md) · 벤치마크 모음: [docs/benchmarks.md](docs/benchmarks.md)

## 렌더링 스펙트럼

```
CSR (순수 클라이언트 렌더링)
 → 정적 SSR (renderToString로 HTML 생성)              … custom/L1
 → 스트리밍 SSR (Suspense + 셸 먼저 전송)             … custom/L2
 → SSR + 데이터 프로토콜 (라우터 중심 loader/action)  … custom/L3
 → 서버 우선 컴포넌트 (컴포넌트가 경계)               … custom/L4
 → 클라이언트 우선 + 서버 함수 (함수가 경계)          … custom/L5
```

프레임워크는 이 스펙트럼의 각 지점을 "제품"으로 만든 것이다:

| 프레임워크 | 스펙트럼의 어디 | 직접 구현 대응 |
|---|---|---|
| Vite 미들웨어 모드 SSR | 번들러 인프라 (렌더링 규약은 직접 작성) | custom 전체의 토대 |
| Next.js App Router | 서버 우선 (RSC + 스트리밍 + Server Action) | custom L2 + L4 |
| React Router 7 | 라우터 중심 (loader/action, 웹 표준) | custom L3 |
| TanStack Start | 클라이언트 우선 (서버 함수 RPC) | custom L5 |

---

## Part 1. 직접 구현 (`custom/`)

React와 Node만으로 렌더러 5종을 구현했다. 각 레벨이 이전 레벨의 어떤 한계를 해결하는지가 핵심 서사.
**상세 원리 설명은 [`custom/README.md`](custom/README.md)에 있다.**

```bash
cd custom
npm install
npm start    # 빌드 + 실행 → http://localhost:3210
npm test     # jsdom으로 클라이언트 하이드레이션 자동 검증 (11개 체크)
```

| 레벨 | 주소 | 렌더러 | 핵심 API |
|---|---|---|---|
| L1 | `/l1` | 기본 SSR | `renderToString` + `hydrateRoot` |
| L2 | `/l2` | 스트리밍 SSR | `renderToPipeableStream` + `Suspense` + `use()` |
| L3 | `/l3` | 라우터 중심 SSR | loader/action, 데이터 직렬화, progressive enhancement |
| L4 | `/l4` | Server Components | 미니 Flight 프로토콜 (`$element`/`$client`/`$lazy` NDJSON 스트림) |
| L5 | `/l5` | 서버 함수 RPC | 클라이언트 우선 + `POST /l5/__rpc` |

특히 L4는 Next.js의 RSC wire 포맷(React Flight)을 단순화해 직접 구현한 것으로, `/l4/flight`에서 컴포넌트 트리가 JSON 행으로 스트리밍되는 원본을 볼 수 있다.

## Part 2. 프레임워크 사용 (`frameworks/`)

같은 개념을 프레임워크가 어떻게 포장하는지 확인하는 예제들. 전부 `npm install` 후 `npm run dev`.

### frameworks/vite-ssr — Vite 미들웨어 모드 (포트 3103)

```bash
cd frameworks/vite-ssr && npm install && npm run dev
```

"Vite SSR"은 프레임워크가 아니라 **프레임워크들이 서 있는 뼈대**다. 커스텀 Node 서버에 Vite를 미들웨어로 끼우고:

- 개발 모드: `vite.ssrLoadModule()`로 서버 엔트리를 HMR과 함께 로드, `transformIndexHtml()`로 번들 주입
- 운영 모드: `vite build`(클라이언트) + `vite build --ssr`(서버) 두 번들의 조합

렌더링 자체는 custom L2와 같은 `renderToPipeableStream` + Suspense 스트리밍이다.
React Router, TanStack Start, Astro 등 Next를 제외한 대부분의 메타프레임워크가 이 구조 위에 라우팅/데이터 규약을 얹었다.
custom의 `src/server.jsx`와 `server.js`를 나란히 열어보면 모양이 거의 같음을 확인할 수 있다.

### frameworks/next — Next.js App Router (포트 3104)

```bash
cd frameworks/next && npm install && npm run dev
```

custom L2 + L4의 공식 구현:

- `app/page.tsx` 전체가 서버 컴포넌트, `Suspense`로 감싼 async 컴포넌트들이 스트리밍된다
- `app/counter.tsx`만 `'use client'` 클라이언트 컴포넌트
- `<form action={like}>` — Server Action. JS 없이도 동작하는 서버 데이터 변경
- 페이지 소스의 `self.__next_f.push(...)` 부분이 custom L4에서 구현했던 flight 페이로드의 실제 모습

### frameworks/react-router — React Router 7 프레임워크 모드 (포트 3101)

```bash
cd frameworks/react-router && npm install && npm run dev
```

custom L3의 공식 구현 (Remix의 후신):

- 라우트 모듈의 `loader`가 첫 요청 때 서버에서 실행되고 데이터가 HTML과 함께 직렬화
- `<Form method="post">` → `action` 실행 → 자동 revalidation. JS 없으면 네이티브 form POST
- 하이드레이션 이후엔 클라이언트 내비게이션(SPA) — loader는 브라우저에서 fetch로 재실행
- `react-router.config.ts`에서 `ssr: false` 한 줄이면 같은 코드가 SPA가 된다

### frameworks/tanstack-start — TanStack Start (포트 3102)

```bash
cd frameworks/tanstack-start && npm install && npm run dev
```

custom L5의 공식 구현:

- `createServerFn()`으로 정의한 서버 함수를 loader와 UI에서 호출 — 빌드 시 RPC로 변환
- `app/db.server.ts`(`.server.ts` 모듈)는 클라이언트 번들에서 자동 제거
- 첫 화면만 SSR이고, 이후 상태는 클라이언트 라우터가 소유 — SSR이 옵션이라는 정체성

> 참고: `@tanstack/react-start`는 API가 빠르게 바뀌는 중이라 이 예제는 **1.131.50에 고정**했다.
> 이 버전에서 문서 head와 스크립트는 `@tanstack/react-router`의 `HeadContent`/`Scripts`로 렌더링한다(`app/routes/__root.tsx`).

## 서로 다른 두 방향: Next vs TanStack Start

| 질문 | Next (RSC) | TanStack Start (서버 함수) |
|---|---|---|
| 무엇이 네트워크를 건너나 | 컴포넌트 실행 결과(직렬화된 트리) | 함수 인자와 반환값 |
| 경계의 단위 | 컴포넌트 (`'use client'`) | 함수 (`createServerFn`) |
| 컴포넌트 코드의 거처 | 서버 기본, 클라이언트는 예외 | 전부 클라이언트 |
| 초기 JS | 표시용 컴포넌트 0바이트 | 전체 앱 번들 |
| SSR의 지위 | 아키텍처의 중심 | SPA를 돕는 옵션 |

React Router는 제3의 길 — 경계의 단위가 **라우트**이고, 웹 표준(form/redirect/Response)을 최대한 그대로 쓴다.

## 참고

- React 문서: [renderToPipeableStream](https://react.dev/reference/react-dom/server/renderToPipeableStream), [`use`](https://react.dev/reference/react/use), [hydrateRoot](https://react.dev/reference/react-dom/client/hydrateRoot)
- Vite SSR 가이드: [vite.dev/guide/ssr](https://vite.dev/guide/ssr)
- Next.js: [Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- React Router: [Framework mode](https://reactrouter.com/start/framework/installation)
- TanStack Start: [tanstack.com/start](https://tanstack.com/start/latest/docs)
