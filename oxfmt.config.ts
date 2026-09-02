import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  ignorePatterns: [
    ...(ultracite.ignorePatterns ?? []),
    "**/dist/**",
    "pnpm-lock.yaml",
  ],
  sortTailwindcss: {
    functions: ["cva"],
    stylesheet: "./frontend/src/style.css",
  },
});
