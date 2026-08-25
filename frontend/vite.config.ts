import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    tailwindcss(),
    react({ compiler: true, exclude: [/\.test\.[tj]sx?$/u] }),
  ],
  server: {
    proxy: {
      "/api": "http://localhost:8080",
    },
  },
  test: {
    globals: false,
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
