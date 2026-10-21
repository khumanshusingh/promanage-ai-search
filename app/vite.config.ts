import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// Production builds are served from GitHub Pages at /promanage-ai-search/; dev stays at /.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? (process.env.PAGES_BASE ?? '/promanage-ai-search/') : '/',
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: { port: 5173 },
}))
