import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // o globo (Three.js) fica num pedaço separado, carregado só quando a aba abre
  build: { chunkSizeWarningLimit: 1100 },
});
