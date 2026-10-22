/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

// GitHub Pages publie le site sous /<nom-du-dépôt>/. BASE_PATH permet de le surcharger
// (ex. BASE_PATH=/ pour un domaine personnalisé).
export default defineConfig(({ command, isPreview }) => {
  const base = process.env.BASE_PATH ?? (command === 'build' || isPreview ? '/vitacare/' : '/');
  return {
    base,
    define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '1.0.0') },
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['icons/favicon.svg', 'icons/apple-touch-icon.png'],
        manifest: {
          id: base,
          name: 'ECE STUDY — De l’atome à la puce',
          short_name: 'ECE STUDY',
          description:
            'Révisions guidées ING2 : cours 0, 1, 2, TD1 et TD2 — leçons, exercices, QCM et flashcards.',
          lang: 'fr',
          dir: 'ltr',
          start_url: base,
          scope: base,
          display: 'standalone',
          orientation: 'any',
          background_color: '#f7f6f2',
          theme_color: '#141b34',
          categories: ['education'],
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            {
              src: 'icons/icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2,woff,ttf}'],
          navigateFallback: 'index.html',
          cleanupOutdatedCaches: true,
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        },
        devOptions: { enabled: false },
      }),
    ],
    build: {
      target: 'es2022',
      sourcemap: false,
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./tests/setup.ts'],
      include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/content/**/*.test.ts'],
    },
  };
});
