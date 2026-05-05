import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// Version bump this when you need to force cache invalidation
const APP_VERSION = '1.1.14';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'TrackMind - Smart Task Manager',
        short_name: 'TrackMind',
        description: 'Energy-aware task scheduling with smart automation',
        theme_color: '#1f2937',
        background_color: '#111827',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Force immediate activation of new service worker
        skipWaiting: true,
        clientsClaim: true,
        // Clean up old caches on activation
        cleanupOutdatedCaches: true,
        // Cache strategies for different asset types
        runtimeCaching: [
          {
            // Cache Google Fonts stylesheets
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Cache Google Fonts webfont files
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Cache GitHub API responses (short-term)
            urlPattern: /^https:\/\/api\.github\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'github-api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5, // 5 minutes
              },
              networkTimeoutSeconds: 10,
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
        // Pre-cache app shell
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // Don't precache source maps
        globIgnores: ['**/*.map'],
      },
      devOptions: {
        enabled: false, // Disable SW in development
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    // Expose version to the app
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  optimizeDeps: {
    force: true,  // Force re-prebundle on every dev server start
    include: ['@trackmind/core', '@trackmind/storage', '@trackmind/sync'],
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    commonjsOptions: {
      include: [/packages/, /node_modules/],
    },
  },
});
