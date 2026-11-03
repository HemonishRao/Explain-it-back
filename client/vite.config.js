import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'client',
  plugins: [react()],
  server: { proxy: { '/api': process.env.VITE_API_URL || 'http://localhost:5000' } },
  build: { outDir: '../dist', emptyOutDir: true },
});
