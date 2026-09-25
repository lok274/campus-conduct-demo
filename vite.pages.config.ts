import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  // Keep this standalone fallback outside Next/Vinext's reserved `pages`
  // directory so the main app never tries to server-render its DOM entry.
  root: path.join(projectRoot, "static-preview"),
  base: "/campus-conduct-demo/",
  publicDir: path.join(projectRoot, "public"),
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  resolve: {
    alias: {
      "@": projectRoot,
    },
  },
  plugins: [react()],
  build: {
    outDir: path.join(projectRoot, "dist-pages"),
    emptyOutDir: true,
  },
});
