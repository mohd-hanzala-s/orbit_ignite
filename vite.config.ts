import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

const apiPort = process.env.PORT || 4000;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src'), '@shared': path.resolve(__dirname, 'shared') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': `http://localhost:${apiPort}`,
      '/scorm-content': `http://localhost:${apiPort}`,
    },
  },
  build: { chunkSizeWarningLimit: 900 },
});
