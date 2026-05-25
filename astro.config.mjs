import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import tailwindcss from '@tailwindcss/vite';
import AstroPWA from '@vite-pwa/astro';

export default defineConfig({
  site: 'https://my-rfp-timeline.local',
  integrations: [
    preact({ compat: false }),
    AstroPWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'My RfP 2026',
        short_name: 'MyRfP 2026',
        description: 'Personal timeline & calendar for Rock for People 2026.',
        theme_color: '#0a0a0a',
        background_color: '#f4ead0',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        orientation: 'any',
        lang: 'en',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2,webmanifest}'],
        navigateFallback: '/',
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  output: 'static',
});
