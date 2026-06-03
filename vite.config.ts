import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        "src/popup/index": resolve(__dirname, "src/popup/index.html"),
        "src/options/index": resolve(__dirname, "src/options/index.html"),
        "src/offscreen/offscreen": resolve(__dirname, "src/offscreen/offscreen.html"),
        "src/background/serviceWorker": resolve(__dirname, "src/background/serviceWorker.ts"),
        "src/content/overlay": resolve(__dirname, "src/content/overlay.ts")
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]"
      }
    }
  }
});
