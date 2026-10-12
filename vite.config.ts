import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  define: { __APP_BUILD_ID__: JSON.stringify(Date.now().toString()) },
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': `http://127.0.0.1:${process.env.API_PORT || '3001'}` }, fs: { deny: ['.env', '.env.*', '**/.env', '**/.env.*'] } },
  build: { sourcemap: false, rollupOptions: { output: { manualChunks: { wallet: ['ethers'], react: ['react', 'react-dom', 'react-router-dom'] } } } }
});
