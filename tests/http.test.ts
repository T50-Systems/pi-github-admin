import { afterEach, describe, expect, it, vi } from "vitest";
import {
	createGitHubClient,
	GitHubApiError,
	MAX_COLLECTION_ITEMS,
	MAX_COLLECTION_PAGES,
	paginate,
	paginateMapped,
	parseNextLink,
	setGitHubClientFactoryForTests,
} from "../src/http.js";

const json = (data: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(data), {
	status: 200,
	headers: { "content-type": "application/json", ...(init.headers ?? {}) },
	...init,
});

afterEach(() => setGitHubClientFactoryForTests());

describe("GitHub HTTP client", () => {
	it("sends sanitized JSON request shapes", async () => {
		const fetchMock = vi.fn(async () => json({ ok: true }));
		const client = createGitHubClient("secret-token", { fetch: fetchMock as typeof fetch });
		await expect(client.request("/repos/o/r", "PATCH", { value: 1, omitted: undefined })).resolves.toEqual({ ok: true });
		const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe("https://api.github.com/repos/o/r");
		expect(init.method).toBe("PATCH");
		expect(init.body).toBe('{"value":1}');
		expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secret-token");
	});

	it("returns an empty object for 204", async () => {
		const client = createGitHubClient("x", { fetch: vi.fn(async () => new Response(null, { status: 204 })) as typeof fetch });
		await expect(client.request("/x", "DELETE")).resolves.toEqual({});
	});

	it("aborts hanging requests within the configured timeout", async () => {
		const hanging = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
			init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
		}));
		const client = createGitHubClient("x", { fetch: hanging as typeof fetch, timeoutMs: 5, maxRetries: 0 });
		await expect(client.request("/hang")).rejects.toMatchObject({ name: "GitHubApiError", retryable: true });
	});

	it("retries retryable reads with bounded backoff", async () => {
		const fetchMock = vi.fn()
			.mockResolvedValueOnce(json({ message: "busy" }, { status: 503 }))
			.mockResolvedValueOnce(json({ ok: true }));
		const sleep = vi.fn(async () => undefined);
		const client = createGitHubClient("x", { fetch: fetchMock as typeof fetch, sleep, random: () => 0, maxRetries: 2 });
		await expect(client.request("/retry")).resolves.toEqual({ ok: true });
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(sleep).toHaveBeenCalledWith(250);
	});

	it("does not retry unsafe mutations", async () => {
		const fetchMock = vi.fn(async () => json({ message: "busy" }, { status: 503 }));
		const client = createGitHubClient("x", { fetch: fetchMock as typeof fetch, maxRetries: 5 });
		await expect(client.request("/unsafe", "POST", { x: 1 })).rejects.toBeInstanceOf(GitHubApiError);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("returns sanitized structured rate-limit errors", async () => {
		const sensitive = `token ghp_${"a".repeat(80)} ${"private".repeat(200)}`;
		const fetchMock = vi.fn(async () => json({ message: sensitive, documentation_url: "https://docs.github.com/rate" }, {
			status: 429,
			headers: { "x-github-request-id": "REQ-1", "x-ratelimit-remaining": "0", "x-ratelimit-reset": "2000000000", "retry-after": "1" },
		}));
		const client = createGitHubClient("x", { fetch: fetchMock as typeof fetch, maxRetries: 0 });
		const error = await client.request("/limited?token=secret").catch((caught) => caught as GitHubApiError);
		expect(error).toMatchObject({ status: 429, requestId: "REQ-1", retryable: true, documentationUrl: "https://docs.github.com/rate" });
		expect(error.message).toContain("Rate limit exhausted");
		expect(error.message).not.toContain("ghp_");
		expect(error.message).not.toContain("secret");
		expect(error.message.length).toBeLessThan(800);
	});

	it("wraps network failures without exposing their message", async () => {
		const client = createGitHubClient("x", { fetch: vi.fn(async () => { throw new TypeError("network token ghp_secret"); }) as typeof fetch, maxRetries: 0 });
		await expect(client.request("/network")).rejects.toThrow("failed before a response");
	});
});

describe("pagination", () => {
	function clientFor(pages: Array<{ data: any; link?: string }>) {
		let index = 0;
		return {
			request: vi.fn(),
			requestWithMeta: vi.fn(async () => {
				const page = pages[index++];
				return { data: page.data, status: 200, headers: new Headers(page.link ? { link: page.link } : {}) };
			}),
		};
	}

	it("parses only GitHub next links", () => {
		expect(parseNextLink('<https://api.github.com/items?page=2>; rel="next", <https://api.github.com/items?page=3>; rel="last"')).toBe("/items?page=2");
		expect(parseNextLink('<https://evil.example/items?page=2>; rel="next"')).toBeUndefined();
		expect(parseNextLink(null)).toBeUndefined();
	});

	it("collects first, multiple, and empty pages", async () => {
		const client = clientFor([
			{ data: [1], link: '<https://api.github.com/items?page=2>; rel="next"' },
			{ data: [2] },
		]);
		await expect(paginate<number>(client, "/items")).resolves.toEqual({ items: [1, 2], pages: 2, truncated: false });
		await expect(paginate<number>(clientFor([{ data: [] }]), "/empty")).resolves.toEqual({ items: [], pages: 1, truncated: false });
	});

	it("reports repeated links and page/item guard truncation", async () => {
		const repeated = '<https://api.github.com/items>; rel="next"';
		await expect(paginate<number>(clientFor([{ data: [1], link: repeated }]), "/items")).resolves.toMatchObject({ reason: "repeated_link", truncated: true });
		const link = '<https://api.github.com/items?page=2>; rel="next"';
		await expect(paginate<number>(clientFor([{ data: [1], link }]), "/items", { maxPages: 1 })).resolves.toMatchObject({ reason: "max_pages", truncated: true });
		await expect(paginate<number>(clientFor([{ data: [1, 2], link }]), "/items", { maxItems: 1 })).resolves.toMatchObject({ items: [1], reason: "max_items", truncated: true });
	});

	it("clamps caller overrides to the exported hard collection guards", async () => {
		const pages = Array.from({ length: MAX_COLLECTION_PAGES }, (_, index) => ({
			data: Array.from({ length: MAX_COLLECTION_ITEMS / MAX_COLLECTION_PAGES }, () => index),
			link: index + 1 < MAX_COLLECTION_PAGES
				? `<https://api.github.com/items?page=${index + 2}>; rel="next"`
				: undefined,
		}));
		const result = await paginate<number>(clientFor(pages), "/items", {
			maxItems: Number.MAX_SAFE_INTEGER,
			maxPages: Number.MAX_SAFE_INTEGER,
		});
		expect(result.items).toHaveLength(MAX_COLLECTION_ITEMS);
		expect(result).toMatchObject({ pages: MAX_COLLECTION_PAGES, truncated: false });
	});

	it("maps wrapped collection pages", async () => {
		const client = clientFor([{ data: { check_runs: [{ name: "one" }] } }]);
		await expect(paginateMapped(client, "/checks", (page: any) => page.check_runs)).resolves.toMatchObject({ items: [{ name: "one" }] });
	});
});
