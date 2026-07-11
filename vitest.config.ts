import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/api.ts", "src/auth.ts", "src/index.ts"],
      thresholds: {
        lines: 25,
        functions: 30,
        statements: 25,
        branches: 20,
      },
    },
  },
  benchmark: {
    include: ["benchmarks/**/*.bench.ts"],
  },
});
