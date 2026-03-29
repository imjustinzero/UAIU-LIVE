import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: true,
    pool: "threads",
    poolOptions: {
      threads: {
        maxThreads: 4,
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      thresholds: {
        statements: 70,
        branches: 70,
        functions: 70,
        lines: 70,
      },
      include: ["server/**/*.ts"],
    },
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
