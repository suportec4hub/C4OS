import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.png', 'favicon.svg', 'logo.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'C4 OS — by C4HUB',
        short_name: 'C4 OS',
        description: 'Command Center comercial by C4HUB',
        theme_color: '#0f9490',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/C4OS/',
        scope: '/C4OS/',
        lang: 'pt-BR',
        icons: [
          // 2. Caminhos dos ícones ajustados para a raiz
          { src: '/favicon.png',  sizes: '64x64',   type: 'image/png' },
          { src: '/logo.png',     sizes: '192x192', type: 'image/png' },
          { src: '/logo.png',     sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        categories: ['business', 'productivity'],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
              networkTimeoutSeconds: 10,
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  // 3. Base path do Vite ajustado para a raiz
  base: '/',
});
