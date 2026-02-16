import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  build: {
    emptyOutDir: true,
    outDir: 'dist-electron',
    minify: false,
    target: 'node16',
    ssr: true, // Defines that we are building for Node/Electron (no DOM)
    rollupOptions: {
      input: {
        main: path.join(__dirname, 'electron/main.ts'),
        preload: path.join(__dirname, 'electron/preload.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        format: 'cjs' // Electron main process uses CommonJS
      },
      external: ['electron', 'path', 'fs', 'child_process'] // Don't bundle these
    }
  }
})
