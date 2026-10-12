/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Göreli yollar: uygulama hem alan adının kökünde (Netlify) hem alt klasörde (GitHub Pages) çalışır
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'KaloriDefteri',
        short_name: 'KaloriDefteri',
        description: 'Türk mutfağı odaklı kalori, içecek ve aktivite takibi',
        lang: 'tr',
        theme_color: '#0e9384',
        background_color: '#f4f7f6',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
        // Open Food Facts yanıtlarını kısa süreli önbelleğe al (çevrimdışıyken son aramalar)
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/world\.openfoodfacts\.org\/api\//,
            handler: 'NetworkFirst',
            options: { cacheName: 'off-api', expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: { react: ['react', 'react-dom'], dexie: ['dexie', 'dexie-react-hooks'] },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
