import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  server: {
    fs: {
      strict: false,
    },
  },
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
