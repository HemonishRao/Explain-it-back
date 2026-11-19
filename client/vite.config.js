import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const clientDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, clientDirectory, 'VITE_');
  const apiTarget = env.VITE_API_URL || 'http://localhost:5000';

  return {
    root: clientDirectory,
    plugins: [react()],
    server: { proxy: { '/api': { target: apiTarget, changeOrigin: true } } },
    build: { outDir: path.resolve(clientDirectory, '../dist'), emptyOutDir: true },
  };
});
