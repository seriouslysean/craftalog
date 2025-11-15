import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.craftalog.app',
  base: process.env.BASE_PATH ?? '/',
  outDir: './dist',
  build: {
    format: 'directory'
  },
  vite: {
    resolve: {
      alias: {
        '@': '/src'
      }
    }
  }
});
