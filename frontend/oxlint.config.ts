import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import react from "ultracite/oxlint/react";
import vitest from "ultracite/oxlint/vitest";

export default defineConfig({
  extends: [core, react, vitest],
  ignorePatterns: ["**/dist/**"],
  rules: {
    // Intentional sequential image decoding / validation (memory-bound).
    "eslint/no-await-in-loop": "off",
    // Existing app patterns that need larger refactors (object-URL cache via ref,
    // form.reset binding, drag-state reset, image dimension probing). Tracked
    // separately from the oxc/ultracite toolchain upgrade.
    "react/exhaustive-effect-dependencies": "off",
    "react/memo-dependencies": "off",
    "react/refs": "off",
    "react/set-state-in-effect": "off",
  },
});
