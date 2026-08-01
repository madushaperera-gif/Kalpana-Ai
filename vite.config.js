import { defineConfig } from 'vite';

export default defineConfig({
  base: '/Kalpana-Ai/',
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    exclude: ['@mlc-ai/web-llm', 'pdfjs-dist'],
  },
  build: {
    sourcemap: false,
    outDir: 'dist',
  },
});
