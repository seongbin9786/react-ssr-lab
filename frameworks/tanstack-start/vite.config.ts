import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'

export default defineConfig({
  plugins: [
    tanstackStart({
      customViteReactPlugin: true,
      tsr: {
        srcDirectory: 'app',
      },
      client: { entry: 'client.tsx' },
      server: { entry: 'ssr.tsx' },
    }),
    react(),
  ],
})
