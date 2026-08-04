/// <reference types="vite/client" />
// 서버 엔트리: Start가 요청마다 라우터를 만들고 defaultStreamHandler로
// 스트리밍 SSR 응답을 만든다. (커스텀 L2의 renderToPipeableStream 자리를 프레임워크가 차지)
import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'
import { createRouter } from './router'

export default createStartHandler({
  createRouter,
})(defaultStreamHandler)
