import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
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
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
      include: ["server/hash-agility.ts", "server/audit-chain-routes.ts", "server/iot-routes.ts"],
    },
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
