import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    exclude: ["**/node_modules/**", "**/dist/**"],
    env: {
      NODE_ENV: "test",
      OLLAMA_EMBEDDING_MODEL: "hf.co/Mungert/all-MiniLM-L6-v2-GGUF",
      OLLAMA_EMBEDDING_DIM: "384",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
    // Run test files sequentially to avoid SQLite database locking issues
    fileParallelism: false,
  },
});
