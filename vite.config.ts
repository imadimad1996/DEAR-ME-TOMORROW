import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2019',
  },
  server: {
    host: true,
    port: 5173,
  },
});
