import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// BASE permite publicar en una subcarpeta (p. ej. GitHub Pages: BASE=/cij-simulator/)
const base = process.env.BASE || './'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icons/favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Simulador CIJ Markem-Imaje S8 / 9040',
        short_name: 'CIJ Trainer',
        description: 'Simulador de entrenamiento para impresoras de chorro de tinta continuo S8 Classic, S8 Contrast y 9040.',
        lang: 'es',
        start_url: '.',
        scope: '.',
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'landscape',
        background_color: '#0b1220',
        theme_color: '#0b1220',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: { environment: 'node', include: ['src/**/*.test.js'] },
})
