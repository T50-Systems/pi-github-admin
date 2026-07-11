import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: ["src/types.ts", "src/api-domains/**/*.ts", "src/tool-domains/{repositories,issues,pull-requests,branches,releases,verification}.ts"],
      thresholds: {
        lines: 80,
        functions: 75,
        statements: 80,
        branches: 70,
      },
    },
  },
  benchmark: {
    include: ["benchmarks/**/*.bench.ts"],
  },
});
