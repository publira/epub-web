import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  ignorePatterns: [
    ...(ultracite.ignorePatterns ?? []),
    ".agents/skills/**",
    "**/dist/**",
    "pnpm-lock.yaml",
  ],
  sortTailwindcss: {
    functions: ["cva"],
    stylesheet: "./frontend/src/style.css",
  },
});
