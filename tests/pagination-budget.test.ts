import { describe, expect, it } from "vitest";
import { evaluatePaginationBudget } from "../scripts/enforce-pagination-budget.mjs";

const budget = {
	schemaVersion: 1,
	benchmark: "guarded-pagination-maximum-collection",
	limits: { p99LatencyMs: 12, peakRssBytes: 134_217_728, peakHeapUsedBytes: 33_554_432 },
};

function measurement(overrides: Record<string, unknown> = {}) {
	return {
		schemaVersion: 1,
		benchmark: "guarded-pagination-maximum-collection",
		configuration: {
			warmupRuns: 3,
			sampleRuns: 25,
			pages: 100,
			items: 10_000,
			transport: "deterministic-in-memory-fake",
			liveGitHubApi: false,
		},
		latencyMs: { p99: 5.819, samples: Array.from({ length: 25 }, () => 5) },
		memoryBytes: { peakRss: 90_787_840, peakHeapUsed: 22_546_576 },
		fixtures: [
			{ name: "max-items", passed: true },
			{ name: "max-pages", passed: true },
			{ name: "repeated-link", passed: true },
			{ name: "exact-boundary-not-truncated", passed: true },
		],
		...overrides,
	};
}

describe("pagination budget enforcement", () => {
	it("accepts a complete hosted-style measurement within every limit", () => {
		expect(evaluatePaginationBudget(measurement(), budget)).toMatchObject({ ok: true, violations: [] });
	});

	it.each([
		["p99LatencyMs", { latencyMs: { p99: 12.001 } }],
		["peakRssBytes", { memoryBytes: { peakRss: 134_217_729, peakHeapUsed: 22_546_576 } }],
		["peakHeapUsedBytes", { memoryBytes: { peakRss: 90_787_840, peakHeapUsed: 33_554_433 } }],
	])("rejects a %s regression", (metric, override) => {
		const result = evaluatePaginationBudget(measurement(override), budget);
		expect(result.ok).toBe(false);
		expect(result.violations).toContainEqual(expect.stringContaining(`${metric} `));
	});

	it("rejects measurements that bypass the deterministic fixture contract", () => {
		const result = evaluatePaginationBudget(measurement({
			configuration: { ...measurement().configuration, liveGitHubApi: true },
			fixtures: [{ name: "max-items", passed: true }],
		}), budget);
		expect(result.ok).toBe(false);
		expect(result.violations).toEqual(expect.arrayContaining([
			"measurement must declare liveGitHubApi=false",
			expect.stringContaining("measurement must pass fixtures"),
		]));
	});
});
