import { defineConfig } from 'vite';
export default defineConfig({
  build:{
    rollupOptions:{ output:{ manualChunks(id) {
      if (id.includes('pdfjs-dist')) return 'pdf';
      if (id.includes('mammoth') || id.includes('jszip')) return 'word';
    } } }
  }
});
