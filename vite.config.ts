import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/Td/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'pwa-*.png'],
      manifest: {
        name: 'Last Stand',
        short_name: 'Last Stand',
        description: 'Tower Defense Roguelike — survive 10 waves of the undead',
        theme_color: '#050505',
        background_color: '#050505',
        display: 'standalone',
        orientation: 'landscape',
        start_url: '/Td/',
        scope: '/Td/',
        icons: [
          { src: 'pwa-72x72.png',   sizes: '72x72',   type: 'image/png' },
          { src: 'pwa-96x96.png',   sizes: '96x96',   type: 'image/png' },
          { src: 'pwa-128x128.png', sizes: '128x128', type: 'image/png' },
          { src: 'pwa-144x144.png', sizes: '144x144', type: 'image/png' },
          { src: 'pwa-152x152.png', sizes: '152x152', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-384x384.png', sizes: '384x384', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\./,
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
})
