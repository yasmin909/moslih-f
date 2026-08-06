import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@assets": path.resolve(__dirname, "src/assets"),
      "qrcode": path.resolve(__dirname, "src/mocks/qrcode.ts"),
    },
    dedupe: ["react", "react-dom"],
  },

  build: {
    outDir: "dist",
    emptyOutDir: true,

    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": [
            "react",
            "react-dom",
            "react-router-dom",
          ],
          "vendor-motion": [
            "framer-motion",
          ],
          "vendor-lucide": [
            "lucide-react",
          ],
          "vendor-xlsx": [
            "xlsx",
          ],
        },
      },
    },
  },

  server: {
    port: 3000,
    host: "0.0.0.0",
  },

  preview: {
    port: 3000,
    host: "0.0.0.0",
  },
});