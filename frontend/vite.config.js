import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5175,
    strictPort: false,
    host: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5261',
        changeOrigin: true,
        secure: false,
        timeout: 60000,
      },
    },
  },
  preview: {
    port: 4173,
    host: true,
    allowedHosts: true,
  },
})
