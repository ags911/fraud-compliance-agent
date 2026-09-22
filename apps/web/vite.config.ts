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
        defaults: path.resolve(import.meta.dirname, 'references/shadcn-defaults.html'),
        paymentsDesignSystem: path.resolve(import.meta.dirname, 'references/payments-design-system.html'),
        // The Payments Overview is kept as a frozen design reference, not a product
        // route: the Overview in the app is the dashboard at /overview. The name
        // still matters even nested under references/ — an `overview.html` entry
        // anywhere makes the dev server answer that path with this page instead of
        // the app, which production does not do.
        overviewReference: path.resolve(import.meta.dirname, 'references/overview-reference.html'),
        rulesPerformance: path.resolve(import.meta.dirname, 'references/rules-performance.html'),
        rulesPerformanceReference: path.resolve(import.meta.dirname, 'references/rules-performance-reference.html'),
      },
    },
  },
})
