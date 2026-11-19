import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// During `npm run dev`, API and sign-in calls go to the local server (npm run local, port 4280).
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:4280",
      "/.auth": "http://localhost:4280",
    },
  },
  build: { outDir: "dist", sourcemap: false, chunkSizeWarningLimit: 900 },
});
