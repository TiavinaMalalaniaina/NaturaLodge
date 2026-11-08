import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'static',
  // No inline scripts/styles: lets nginx send a strict Content-Security-Policy without 'unsafe-inline'.
  build: { inlineStylesheets: 'never' },
  vite: { plugins: [tailwindcss()], build: { assetsInlineLimit: 0 } },
});
