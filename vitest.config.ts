import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    exclude: ["**/node_modules/**", "**/dist/**"],
    env: {
      NODE_ENV: "test",
      OLLAMA_EMBEDDING_MODEL: "paraphrase-multilingual:278m-mpnet-base-v2-fp16",
      OLLAMA_EMBEDDING_DIM: "768",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
    // Run test files sequentially to avoid SQLite database locking issues
    fileParallelism: false,
  },
});
