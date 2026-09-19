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
        // The Payments Overview is kept as a frozen design reference, not a product
        // route: the Overview in the app is the dashboard at /overview. The name
        // matters — an `overview.html` entry makes the dev server answer /overview
        // with this page instead of the app, which production does not do.
        overviewReference: path.resolve(import.meta.dirname, 'overview-reference.html'),
        rulesPerformance: path.resolve(import.meta.dirname, 'rules-performance.html'),
        rulesPerformanceReference: path.resolve(import.meta.dirname, 'rules-performance-reference.html'),
      },
    },
  },
})
