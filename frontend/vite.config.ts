import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Para onde o front manda `/api` em desenvolvimento.
 *
 * Fixo na 3333, como sempre foi — mas quando essa porta já está ocupada por
 * outro projeto na mesma máquina, a API sobe noutra e o front precisa
 * acompanhar: `API_PROXY=http://localhost:3344 npm run dev`.
 */
const api = process.env.API_PROXY ?? 'http://localhost:3333';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Separa bibliotecas pesadas para melhorar o cache no navegador.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          radix: [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-popover',
            '@radix-ui/react-tabs',
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: api,
        changeOrigin: true,
      },
      '/socket.io': {
        target: api,
        ws: true,
      },
    },
  },
});
