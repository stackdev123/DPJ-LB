
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react()
  ],
  // Base path for standard deployment
  base: '/', 
  build: {
    outDir: 'dist',
    sourcemap: false
  },
  server: {
    port: 3000
  }
});
