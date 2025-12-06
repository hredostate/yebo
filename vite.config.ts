
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'School Guardian 360',
        short_name: 'Guardian360',
        description: 'An AI-powered dashboard for school administrators to manage reports, tasks, students, and institutional data, providing actionable insights and proactive intelligence to foster a safe and efficient learning environment.',
        theme_color: '#1D4ED8',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        icons: [
          {
            src: '/icons/icon.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
          },
          {
            src: '/icons/icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
          },
          {
            src: 'https://tyvufbldcucgmmlattct.supabase.co/storage/v1/object/public/Images/imageedit_1_5058819643%20(1).png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512x512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        // Clean up outdated caches on activation
        cleanupOutdatedCaches: true,
        // Skip waiting to activate new service worker immediately
        skipWaiting: true,
        // Claim clients to take control immediately
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /\.(?:png|gif|jpg|jpeg|svg)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
              },
            },
          },
        ],
      },
    }),
  ],
  build: {
    // Generate source maps for debugging
    sourcemap: false,
    // Ensure unique chunk names with content hash
    rollupOptions: {
      output: {
        // Use content hash in filenames for better cache invalidation
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  }
});