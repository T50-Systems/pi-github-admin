import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import {
	MAX_COLLECTION_ITEMS,
	MAX_COLLECTION_PAGES,
	paginate,
	type GitHubClient,
	type PaginatedResult,
} from "../src/http.js";

const WARMUP_RUNS = 3;
const SAMPLE_RUNS = 25;
const ITEMS_PER_PAGE = MAX_COLLECTION_ITEMS / MAX_COLLECTION_PAGES;
const START_PATH = "/benchmark/items?page=1";
const FIXTURE_DIRECTORY = path.resolve(import.meta.dirname, "../tests/fixtures/pagination");
const OUTPUT_PATH = path.resolve(process.env.PAGINATION_BENCHMARK_OUTPUT ?? "artifacts/pagination-benchmark.json");

interface FixturePage {
	path: string;
	items: number[];
	next?: string;
}

interface PaginationFixture {
	name: string;
	startPath: string;
	pages: FixturePage[];
	options: { maxItems?: number; maxPages?: number };
	expected: PaginatedResult<number>;
}

function link(next?: string): Headers {
	return new Headers(next ? { link: `<https://api.github.com${next}>; rel="next"` } : {});
}

function fixtureClient(fixture: PaginationFixture): GitHubClient {
	const pages = new Map(fixture.pages.map((page) => [page.path, page]));
	return {
		request: async () => undefined,
		requestWithMeta: async (requestPath: string) => {
			const page = pages.get(requestPath);
			if (!page) throw new Error(`fixture '${fixture.name}' has no page for ${requestPath}`);
			return { data: page.items, status: 200, headers: link(page.next) };
		},
	} as unknown as GitHubClient;
}

function maximumCollectionClient(observeMemory: () => void): GitHubClient {
	return {
		request: async () => undefined,
		requestWithMeta: async (requestPath: string) => {
			if (!requestPath.startsWith("/benchmark/items?page=")) {
				throw new Error(`benchmark attempted unexpected request: ${requestPath}`);
			}
			const page = Number(new URL(requestPath, "https://api.github.com").searchParams.get("page"));
			if (!Number.isInteger(page) || page < 1 || page > MAX_COLLECTION_PAGES) {
				throw new Error(`benchmark attempted out-of-range page: ${requestPath}`);
			}
			const first = (page - 1) * ITEMS_PER_PAGE;
			const data = Array.from({ length: ITEMS_PER_PAGE }, (_, index) => first + index);
			observeMemory();
			const next = page < MAX_COLLECTION_PAGES ? `/benchmark/items?page=${page + 1}` : undefined;
			return { data, status: 200, headers: link(next) };
		},
	} as unknown as GitHubClient;
}

function percentile(sorted: number[], quantile: number): number {
	return sorted[Math.max(0, Math.ceil(sorted.length * quantile) - 1)]!;
}

function round(value: number): number {
	return Number(value.toFixed(3));
}

async function readFixtures(): Promise<PaginationFixture[]> {
	const names = ["max-items.json", "max-pages.json", "repeated-link.json", "exact-boundary.json"];
	return Promise.all(names.map(async (name) => JSON.parse(await readFile(path.join(FIXTURE_DIRECTORY, name), "utf8")) as PaginationFixture));
}

describe("guarded pagination measurement", () => {
	it("measures a deterministic fake 100-page/10,000-item collection", async () => {
		const fixtureResults = [];
		for (const fixture of await readFixtures()) {
			const actual = await paginate<number>(fixtureClient(fixture), fixture.startPath, fixture.options);
			expect(actual).toEqual(fixture.expected);
			fixtureResults.push({ name: fixture.name, passed: true, result: actual });
		}

		let peakRssBytes = process.memoryUsage().rss;
		let peakHeapUsedBytes = process.memoryUsage().heapUsed;
		const observeMemory = () => {
			const memory = process.memoryUsage();
			peakRssBytes = Math.max(peakRssBytes, memory.rss);
			peakHeapUsedBytes = Math.max(peakHeapUsedBytes, memory.heapUsed);
		};
		const run = async () => {
			const result = await paginate<number>(maximumCollectionClient(observeMemory), START_PATH, {
				maxItems: MAX_COLLECTION_ITEMS,
				maxPages: MAX_COLLECTION_PAGES,
			});
			observeMemory();
			return result;
		};
		const assertMaximumResult = (result: PaginatedResult<number>) => {
			expect(result.pages).toBe(MAX_COLLECTION_PAGES);
			expect(result.truncated).toBe(false);
			expect(result.items).toHaveLength(MAX_COLLECTION_ITEMS);
			expect(result.items[0]).toBe(0);
			expect(result.items.at(-1)).toBe(MAX_COLLECTION_ITEMS - 1);
		};

		for (let index = 0; index < WARMUP_RUNS; index += 1) assertMaximumResult(await run());
		const samplesMs: number[] = [];
		for (let index = 0; index < SAMPLE_RUNS; index += 1) {
			const started = performance.now();
			const result = await run();
			samplesMs.push(performance.now() - started);
			assertMaximumResult(result);
		}
		const sorted = [...samplesMs].sort((left, right) => left - right);
		const output = {
			schemaVersion: 1,
			benchmark: "guarded-pagination-maximum-collection",
			measurementOnly: true,
			budget: null,
			configuration: {
				warmupRuns: WARMUP_RUNS,
				sampleRuns: SAMPLE_RUNS,
				pages: MAX_COLLECTION_PAGES,
				items: MAX_COLLECTION_ITEMS,
				itemsPerPage: ITEMS_PER_PAGE,
				transport: "deterministic-in-memory-fake",
				liveGitHubApi: false,
			},
			environment: { node: process.version, platform: process.platform, arch: process.arch },
			latencyMs: {
				p50: round(percentile(sorted, 0.5)),
				p95: round(percentile(sorted, 0.95)),
				p99: round(percentile(sorted, 0.99)),
				samples: samplesMs.map(round),
			},
			memoryBytes: { peakRss: peakRssBytes, peakHeapUsed: peakHeapUsedBytes },
			fixtures: fixtureResults,
		};
		await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
		await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
		console.log(`PAGINATION_BENCHMARK_JSON=${JSON.stringify(output)}`);
	});
});
