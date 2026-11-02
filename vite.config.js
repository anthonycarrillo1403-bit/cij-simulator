import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// BASE permite publicar en una subcarpeta (p. ej. GitHub Pages: BASE=/cij-simulator/)
const base = process.env.BASE || './'
// start_url/scope/id absolutos cuando se publica en subcarpeta: evita que el icono
// instalado no abra en algunos lanzadores Android (WebAPK) por rutas relativas.
const appUrl = base === './' ? '.' : base

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icons/favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'CIJ Trainer · Markem-Imaje 9040',
        short_name: 'CIJ Trainer',
        description: 'Entrenamiento guiado, codificación y misiones con el panel real de la Markem-Imaje 9040 (monochorro y bichorro).',
        lang: 'es',
        id: appUrl,
        start_url: appUrl,
        scope: appUrl,
        // 'standalone' es el modo con mejor compatibilidad; la app pide pantalla
        // completa por sí misma al primer toque.
        display: 'standalone',
        orientation: 'any',
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
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
  test: { environment: 'node', include: ['src/**/*.test.js'] },
})
