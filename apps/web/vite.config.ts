/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// In development the browser talks ONLY to this dev server (http://localhost:5173).
// Requests to /api are forwarded to the Express API on :8080. To the browser everything is
// one origin, so cookies just work and no CORS setup is needed.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8080",
      "/health": "http://localhost:8080",
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        // put the big stable libraries in their own file so they cache well between deploys
        manualChunks(id: string) {
          // [/\\] = a forward slash or a backslash (Windows paths)
          if (/node_modules[/\\](react|react-dom|react-router|scheduler)[/\\]/.test(id)) return "react";
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    css: false,
  },
});
