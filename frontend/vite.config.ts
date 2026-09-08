import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  css: { postcss: { plugins: [tailwindcss()] } },
  server: {
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:3100' },
  },
});