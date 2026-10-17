import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Local development only: the API runs on 3000 and owns cookies/CSRF.
// Production serves this build from the same origin as the API.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false, // API APP_ORIGIN defaults to :5173; POSTs from another port are refused by its origin check.
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: false } },
  },
  build: { outDir: 'dist', sourcemap: false, target: 'es2022' },
});
