import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  // L'app installée (PWA) de préprod doit se distinguer de celle de prod sur l'écran d'accueil.
  const isPreprod = env.VITE_APP_ENV === 'preprod';
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'pwa-source.svg'],
        manifest: {
          name: isPreprod ? 'Natura Lodge PREPROD' : 'Natura Lodge',
          short_name: isPreprod ? 'NL Preprod' : 'Natura Lodge',
          description: 'Système de gestion hôtelière Natura Lodge',
          theme_color: isPreprod ? '#f59e0b' : '#00685d',
          background_color: '#F7F5F2',
          display: 'standalone',
          start_url: '/',
          icons: [
            { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        // Cache uniquement les assets statiques buildés (JS/CSS/HTML/icônes) —
        // pas d'appels /api, les données réservations/chambres doivent rester temps réel.
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
          navigateFallbackDenylist: [/^\/api\//],
          // Handlers for staff push notifications (public/push-sw.js).
          importScripts: ['push-sw.js'],
        },
      }),
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    // Même port que `dev` (3000) : c'est la seule origine autorisée en CORS par le
    // serveur (FRONTEND_URL dans server/.env). `vite preview` utilise 4173 par
    // défaut, ce qui casse les appels API sans ce réglage.
    preview: {
      port: 3000,
      host: '0.0.0.0',
    },
  };
});
