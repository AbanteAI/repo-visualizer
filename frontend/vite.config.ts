import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      // Could be a single entry point
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'RepoVisualizer',
      formats: ['es', 'umd'],
      fileName: (format) => `repo-visualizer.${format}.js`
    },
    rollupOptions: {
      // Externalize deps that shouldn't be bundled
      external: ['react', 'react-dom'],
      output: {
        // Global vars for UMD build
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM'
        }
      }
    }
  }
})
