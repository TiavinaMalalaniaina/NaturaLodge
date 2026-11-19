import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'static',
  // Public origin (https://…), baked at build: enables og:image/og:url and hreflang, which need absolute URLs.
  site: process.env.SITE_URL || undefined,
  // No inline scripts/styles: lets nginx send a strict Content-Security-Policy without 'unsafe-inline'.
  build: { inlineStylesheets: 'never' },
  vite: { plugins: [tailwindcss()], build: { assetsInlineLimit: 0 } },
});
