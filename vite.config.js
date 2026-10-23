import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    rollupOptions: { input: 'index.source.html' }
  },
  test: { environment: 'node', include: ['tests/unit/**/*.test.js'] }
});
