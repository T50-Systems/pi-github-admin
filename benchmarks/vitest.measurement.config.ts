import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["benchmarks/pagination.measurement.test.ts"],
	},
});
