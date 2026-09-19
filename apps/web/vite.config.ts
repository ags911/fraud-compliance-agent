import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(import.meta.dirname, 'index.html'),
        defaults: path.resolve(import.meta.dirname, 'shadcn-defaults.html'),
        paymentsDesignSystem: path.resolve(import.meta.dirname, 'payments-design-system.html'),
        dashboard: path.resolve(import.meta.dirname, 'dashboard.html'),
        overview: path.resolve(import.meta.dirname, 'overview.html'),
        rulesPerformance: path.resolve(import.meta.dirname, 'rules-performance.html'),
        rulesPerformanceReference: path.resolve(import.meta.dirname, 'rules-performance-reference.html'),
      },
    },
  },
})
