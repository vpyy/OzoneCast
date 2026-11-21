import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://database-api:8000',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://database-api:8000',
        ws: true
      }
    }
  }
})

