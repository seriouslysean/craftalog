import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  site: "https://seriouslysean.github.io",
  base: process.env.BASE_PATH ?? "/",
  outDir: "./dist",
  prefetch: {
    prefetchAll: true,
  },
  build: {
    format: "directory",
  },
  vite: {
    resolve: {
      alias: {
        "@": "/src",
      },
    },
  },
});
