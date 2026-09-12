import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    modulePreload: false,
    rollupOptions: {
      input: { index: 'index.html', welcome: 'welcome.html', demo: 'demo.html', background: 'src/background.ts' },
      output: { entryFileNames: chunk => chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js' },
    },
  },
});
