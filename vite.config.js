import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: { passes: 2 },
      mangle: true,
      output: { ascii_only: true },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          // These are heavy and only used by the admin dashboard — split them out
          if (id.includes('recharts') || id.includes('/d3-')) return 'vendor-charts';
          if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('xlsx')) return 'vendor-export';
          // Everything else (react, react-dom, supabase, lucide, scheduler…) stays in one vendor chunk
          return 'vendor';
        },
      },
    },
  },
})
