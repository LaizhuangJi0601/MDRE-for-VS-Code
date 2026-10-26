import { defineConfig } from 'vite';
import { modernFonts } from './scripts/font-assets.mjs';

export default defineConfig({
  plugins: [modernFonts()],
  base: './',
  build: { target: 'es2022', outDir: 'dist/webview', manifest: true, rollupOptions:{input:{main:'index.html',settings:'settings.html'}} },
});
