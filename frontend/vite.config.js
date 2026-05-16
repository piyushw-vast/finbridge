import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'FinBridge',
        short_name: 'FinBridge',
        description: 'AI-powered invoice exchange — upload bills, track status, get AI extraction in seconds.',
        start_url: '/company/dashboard',
        display: 'standalone',
        background_color: '#f8fafc',
        theme_color: '#4f46e5',
        orientation: 'portrait-primary',
        categories: ['finance', 'business', 'productivity'],
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Upload Invoice',
            short_name: 'Upload',
            description: 'Upload a new invoice or receipt',
            url: '/company/upload',
            icons: [{ src: '/favicon.svg', sizes: 'any' }],
          },
          {
            name: 'My Invoices',
            short_name: 'Invoices',
            description: 'View all your invoices',
            url: '/company/dashboard',
            icons: [{ src: '/favicon.svg', sizes: 'any' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // Cache API responses for invoice list briefly
            urlPattern: /\/api\/v1\/invoices(\?.*)?$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-invoices',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 5 },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
})
