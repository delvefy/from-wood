import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

// CAP_BUILD=1 builds the bundle for the Capacitor native shell: assets load
// from the app package (relative base instead of the GitHub Pages
// /from-wood/ prefix) and the service worker is disabled — the webview loads
// everything locally, so PWA caching would only add stale-update risk.
const capBuild = !!process.env.CAP_BUILD;

export default defineConfig({
  base: capBuild ? './' : '/from-wood/',
  plugins: [
    svelte(),
    VitePWA({
      disable: capBuild,
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'From Wood',
        short_name: 'From Wood',
        description: 'Gather resources, craft items, research tech, automate everything.',
        theme_color: '#12160f',
        background_color: '#12160f',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/from-wood/',
        scope: '/from-wood/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
    }),
  ],
});
