import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/bedrock': {
        target: 'https://cko-ai-proxy.sb.anacondaconnect.com',
        changeOrigin: true,
      },
      '/groq': {
        target: 'https://cko-ai-proxy.sb.anacondaconnect.com',
        changeOrigin: true,
      }
    }
  }
})