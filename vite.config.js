import { defineConfig } from 'vite';

// `npm run build` -> dist/ for the phone app (everything bundled, works offline).
// `npm run build:web` -> dist-artifact/ for the browser preview (three.js from a CDN).
export default defineConfig(({ mode }) => ({
  base: './',
  build: mode === 'artifact'
    ? { outDir: 'dist-artifact', rollupOptions: { external: ['three'], output: { format: 'es', inlineDynamicImports: true } } }
    : { outDir: 'dist', chunkSizeWarningLimit: 1500 },
}));
