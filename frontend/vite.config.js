import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    proxy: {
      '/api/db': {
        target: 'http://database-api:8001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/db/, '')
      },
      '/api/ingest': {
        target: 'http://data-ingestion:8002',
        changeOrigin: true
      },
      '/api/analysis': {
        target: 'http://data-analysis:8003',
        changeOrigin: true
      },
      '/api/clustering': {
        target: 'http://clustering:8004',
        changeOrigin: true
      },
      '/api/prediction': {
        target: 'http://prediction:8005',
        changeOrigin: true
      }
    }
  }
})

