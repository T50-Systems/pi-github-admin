import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { paginate, type GitHubClient, type PaginatedResult, type PaginationOptions } from "../src/http.js";

interface Fixture {
	name: string;
	startPath: string;
	pages: Array<{ path: string; items: number[]; next?: string }>;
	options: PaginationOptions;
	expected: PaginatedResult<number>;
}

const directory = path.join(import.meta.dirname, "fixtures", "pagination");
const fixtureNames = ["max-items.json", "max-pages.json", "repeated-link.json", "exact-boundary.json"];

async function loadFixture(name: string): Promise<Fixture> {
	return JSON.parse(await readFile(path.join(directory, name), "utf8")) as Fixture;
}

function clientFor(fixture: Fixture): GitHubClient {
	const pages = new Map(fixture.pages.map((page) => [page.path, page]));
	return {
		request: async () => undefined,
		requestWithMeta: async (requestPath: string) => {
			const page = pages.get(requestPath);
			if (!page) throw new Error(`fixture '${fixture.name}' has no page for ${requestPath}`);
			const headers = new Headers(page.next ? { link: `<https://api.github.com${page.next}>; rel="next"` } : {});
			return { data: page.items, status: 200, headers };
		},
	} as unknown as GitHubClient;
}

describe("pagination guard fixtures", () => {
	for (const fixtureName of fixtureNames) {
		it(fixtureName, async () => {
			const fixture = await loadFixture(fixtureName);
			await expect(paginate<number>(clientFor(fixture), fixture.startPath, fixture.options)).resolves.toEqual(fixture.expected);
		});
	}
});
