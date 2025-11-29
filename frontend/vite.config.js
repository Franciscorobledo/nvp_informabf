import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Configuración dinámica: usa variables de entorno
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:1000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  define: {
    'process.env': process.env,
  }
})
