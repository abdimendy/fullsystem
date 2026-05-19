import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'YellowBook — Buugga Ganacsiga',
        short_name: 'YellowBook',
        description:
          'Buugga telefoonka ganacsiga Soomaaliya. Raadi shirkado, telefoon, iyo adeegyo.',
        theme_color: '#f59e0b',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'so',
        icons: [
          {
            src: '/favicon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/favicon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,ico,svg,woff2,json}'],
      },
    }),
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
      },
    },
  },
  preview: {
    port: 4173,
    host: true,
    allowedHosts: true,
  },
})
