import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir:      "dist",
    sourcemap:   false,
    minify:      "esbuild",
    chunkSizeWarningLimit: 1000
  },
  server: {
    port: 3000,
    proxy: {
      // Dev proxy — avoids CORS issues during local development
      "/api": {
        target:      process.env.VITE_API_URL || "http://localhost:3001",
        changeOrigin: true,
        rewrite:     (path) => path.replace(/^\/api/, "")
      }
    }
  }
});
