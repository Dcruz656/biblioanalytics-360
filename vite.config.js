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
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('recharts') || id.includes('/d3-') || id.includes('d3-shape') || id.includes('d3-scale')) return 'vendor-charts';
          if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('xlsx')) return 'vendor-export';
          if (id.includes('@supabase')) return 'vendor-supabase';
          if (id.includes('lucide-react')) return 'vendor-lucide';
          if (id.includes('react-dom') || id.match(/\/react\//)) return 'vendor-react';
          return 'vendor';
        },
      },
    },
  },
})
