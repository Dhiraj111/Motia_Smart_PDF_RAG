import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/upload': 'http://localhost:3000',
      '/chat': 'http://localhost:3000',
      '/status': 'http://localhost:3000',
    }
  }
})