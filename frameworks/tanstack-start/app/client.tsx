/// <reference types="vite/client" />
// 클라이언트 엔트리: 하이드레이션. 이후의 진실의 원천은 이 클라이언트 라우터다.
import { StartClient } from '@tanstack/react-start'
import { hydrateRoot } from 'react-dom/client'
import { createRouter } from './router'

const router = createRouter()

hydrateRoot(document, <StartClient router={router} />)
