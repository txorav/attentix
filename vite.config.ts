import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { handleCaptureUrlRequest } from './server/capture-service';

function urlCapturePlugin(): Plugin {
  return {
    name: 'url-capture-api',
    configureServer(server) {
      server.middlewares.use('/api/capture-url', (req, res) => {
        handleCaptureUrlRequest(req, res);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/capture-url', (req, res) => {
        handleCaptureUrlRequest(req, res);
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), urlCapturePlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['onnxruntime-web'],
  },
  server: {
    port: 3000,
    host: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
