import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    exclude: ["**/node_modules/**", "**/dist/**"],
    env: {
      NODE_ENV: "test",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
    // Run test files sequentially to avoid SQLite database locking issues
    fileParallelism: false,
  },
});
