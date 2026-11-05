import { defineConfig } from 'vite';
import { modernFonts } from './scripts/font-assets.mjs';
import { pdfAssets } from './scripts/pdf-assets.mjs';

export default defineConfig({
  plugins: [modernFonts(), pdfAssets()],
  base: './',
  build: { target: 'es2022', outDir: 'dist/webview', manifest: true, rollupOptions:{input:{main:'index.html',settings:'settings.html',viewer:'viewer.html'}} },
});
