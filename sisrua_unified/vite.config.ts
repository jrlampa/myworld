import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            // Simplified chunking to avoid circular dependencies
            if (id.includes('node_modules')) {
              // Put all React-related packages together (react, react-dom, react-leaflet, lucide-react, etc.)
              if (id.includes('react')) {
                return 'react-vendor';
              }
              // Leaflet core (non-React)
              if (id.includes('leaflet')) {
                return 'map-vendor';
              }
              // Other UI libraries
              if (id.includes('recharts') || id.includes('framer-motion')) {
                return 'ui-vendor';
              }
              // Everything else
              return 'vendor';
            }
          }
        }
      },
      chunkSizeWarningLimit: 500,
      // Use esbuild minification (faster and already included)
      minify: 'esbuild',
      target: 'esnext'
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
      include: ['tests/**/*.test.{ts,tsx}'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules/',
          'tests/',
          'legacy_src/',
          '*.config.ts',
          'dist/',
          'build/'
        ]
      }
    },
  };
});
