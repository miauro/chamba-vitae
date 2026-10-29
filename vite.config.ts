import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base relativa: funciona en GitHub Pages bajo cualquier nombre de repo y abriendo dist/ en local
export default defineConfig({
  base: './',
  plugins: [react()],
  // 127.0.0.1 explícito: en Windows "localhost" a veces solo escucha en IPv6 (::1)
  server: { host: '127.0.0.1', port: 5173, open: true },
  preview: { host: '127.0.0.1', port: 4173 },
});
