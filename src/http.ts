import { resolveGitHubAuth } from "./auth.js";

export const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
export const DEFAULT_MAX_RETRIES = 2;
export const DEFAULT_MAX_PAGES = 20;
export const DEFAULT_MAX_ITEMS = 2_000;
export const MAX_COLLECTION_PAGES = 100;
export const MAX_COLLECTION_ITEMS = 10_000;
export const MAX_ERROR_BODY_LENGTH = 512;

export interface GitHubRequestOptions {
	timeoutMs?: number;
	maxRetries?: number;
	fetch?: typeof fetch;
	sleep?: (milliseconds: number) => Promise<void>;
	random?: () => number;
}

export interface GitHubRateLimit {
	limit?: number;
	remaining?: number;
	resetAt?: string;
	retryAfterSeconds?: number;
}

export class GitHubApiError extends Error {
	readonly status?: number;
	readonly requestId?: string;
	readonly documentationUrl?: string;
	readonly rateLimit: GitHubRateLimit;
	readonly retryable: boolean;
	readonly method: string;
	readonly path: string;

	constructor(input: {
		message: string;
		method: string;
		path: string;
		status?: number;
		requestId?: string;
		documentationUrl?: string;
		rateLimit?: GitHubRateLimit;
		retryable?: boolean;
		cause?: unknown;
	}) {
		super(input.message, { cause: input.cause });
		this.name = "GitHubApiError";
		this.method = input.method;
		this.path = input.path;
		this.status = input.status;
		this.requestId = input.requestId;
		this.documentationUrl = input.documentationUrl;
		this.rateLimit = input.rateLimit ?? {};
		this.retryable = Boolean(input.retryable);
	}
}

export interface GitHubResponse<T = unknown> {
	data: T;
	status: number;
	headers: Headers;
}

export interface GitHubClient {
	request<T = any>(path: string, method?: string, body?: unknown): Promise<T>;
	requestWithMeta<T = any>(path: string, method?: string, body?: unknown): Promise<GitHubResponse<T>>;
}

let testClientFactory: (() => Promise<GitHubClient> | GitHubClient) | undefined;

/** Test-only injection point. Passing undefined restores normal auth-backed behavior. */
export function setGitHubClientFactoryForTests(
	factory?: () => Promise<GitHubClient> | GitHubClient,
): void {
	testClientFactory = factory;
}

export async function getGitHubClient(): Promise<GitHubClient> {
	if (testClientFactory) return testClientFactory();
	const { token } = await resolveGitHubAuth();
	return createGitHubClient(token);
}

export function createGitHubClient(
	token: string,
	options: GitHubRequestOptions = {},
): GitHubClient {
	const fetchImpl = options.fetch ?? fetch;
	const timeoutMs = boundedInteger(options.timeoutMs, DEFAULT_REQUEST_TIMEOUT_MS, 1, 120_000);
	const maxRetries = boundedInteger(options.maxRetries, DEFAULT_MAX_RETRIES, 0, 5);
	const sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
	const random = options.random ?? Math.random;

	async function requestWithMeta<T = any>(path: string, method = "GET", body?: unknown): Promise<GitHubResponse<T>> {
		const normalizedMethod = method.toUpperCase();
		const retries = isRetrySafe(normalizedMethod) ? maxRetries : 0;
		let attempt = 0;
		while (true) {
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), timeoutMs);
			try {
				const response = await fetchImpl(`https://api.github.com${path}`, {
					method: normalizedMethod,
					signal: controller.signal,
					headers: {
						Accept: "application/vnd.github+json",
						Authorization: `Bearer ${token}`,
						"User-Agent": "pi-github-admin",
						"X-GitHub-Api-Version": "2022-11-28",
						...(body === undefined ? {} : { "Content-Type": "application/json" }),
					},
					body: body === undefined ? undefined : JSON.stringify(stripUndefined(body)),
				});
				if (!response.ok) {
					const error = await responseToError(response, normalizedMethod, path);
					if (attempt < retries && isRetryableResponse(response.status, error.rateLimit)) {
						await sleep(retryDelay(attempt, error.rateLimit, random));
						attempt += 1;
						continue;
					}
					throw error;
				}
				const data = (response.status === 204 ? {} : await response.json()) as T;
				return { data, status: response.status, headers: response.headers };
			} catch (error) {
				if (error instanceof GitHubApiError) throw error;
				const timedOut = controller.signal.aborted;
				if (!timedOut && attempt < retries && isTransientNetworkError(error)) {
					await sleep(retryDelay(attempt, {}, random));
					attempt += 1;
					continue;
				}
				throw new GitHubApiError({
					message: timedOut
						? `GitHub API ${normalizedMethod} ${safePath(path)} timed out after ${timeoutMs}ms.`
						: `GitHub API ${normalizedMethod} ${safePath(path)} failed before a response.`,
					method: normalizedMethod,
					path: safePath(path),
					retryable: isRetrySafe(normalizedMethod),
					cause: error,
				});
			} finally {
				clearTimeout(timer);
			}
		}
	}

	return {
		request: async <T = any>(path: string, method = "GET", body?: unknown) =>
			(await requestWithMeta<T>(path, method, body)).data,
		requestWithMeta,
	};
}

export interface PaginationOptions {
	maxPages?: number;
	maxItems?: number;
}

export interface PaginatedResult<T> {
	items: T[];
	pages: number;
	truncated: boolean;
	reason?: "max_pages" | "max_items" | "repeated_link";
}

export async function paginate<T>(
	client: GitHubClient,
	path: string,
	options: PaginationOptions = {},
): Promise<PaginatedResult<T>> {
	return paginateMapped<T[], T>(client, path, (page) => page, options);
}

export async function paginateMapped<TPage, TItem>(
	client: GitHubClient,
	path: string,
	mapPage: (page: TPage) => TItem[],
	options: PaginationOptions = {},
): Promise<PaginatedResult<TItem>> {
	const maxPages = boundedInteger(options.maxPages, DEFAULT_MAX_PAGES, 1, MAX_COLLECTION_PAGES);
	const maxItems = boundedInteger(options.maxItems, DEFAULT_MAX_ITEMS, 1, MAX_COLLECTION_ITEMS);
	const items: TItem[] = [];
	const seen = new Set<string>();
	let next: string | undefined = path;
	let pages = 0;
	while (next) {
		if (pages >= maxPages) return { items, pages, truncated: true, reason: "max_pages" };
		if (seen.has(next)) return { items, pages, truncated: true, reason: "repeated_link" };
		seen.add(next);
		const response = await client.requestWithMeta<TPage>(next);
		pages += 1;
		const pageItems = mapPage(response.data);
		const remaining = maxItems - items.length;
		items.push(...pageItems.slice(0, remaining));
		const nextLink = parseNextLink(response.headers.get("link"));
		if (pageItems.length > remaining || items.length >= maxItems) {
			return { items, pages, truncated: Boolean(nextLink), reason: nextLink ? "max_items" : undefined };
		}
		next = nextLink;
	}
	return { items, pages, truncated: false };
}

export function parseNextLink(link: string | null): string | undefined {
	if (!link) return undefined;
	for (const part of link.split(",")) {
		const match = part.match(/<([^>]+)>\s*;\s*rel="([^"]+)"/);
		if (!match || match[2] !== "next") continue;
		try {
			const url = new URL(match[1], "https://api.github.com");
			if (url.origin !== "https://api.github.com") return undefined;
			return `${url.pathname}${url.search}`;
		} catch {
			return undefined;
		}
	}
	return undefined;
}

function isRetrySafe(method: string): boolean {
	return method === "GET" || method === "HEAD";
}

function isRetryableResponse(status: number, rateLimit: GitHubRateLimit): boolean {
	return status === 429 || status === 502 || status === 503 || status === 504 || (status === 403 && rateLimit.remaining === 0);
}

function isTransientNetworkError(error: unknown): boolean {
	return error instanceof TypeError || (error instanceof Error && /network|fetch|socket|reset/i.test(error.message));
}

function retryDelay(attempt: number, rateLimit: GitHubRateLimit, random: () => number): number {
	if (rateLimit.retryAfterSeconds !== undefined) return Math.min(rateLimit.retryAfterSeconds * 1_000, 30_000);
	return Math.min(250 * 2 ** attempt + Math.floor(random() * 100), 5_000);
}

async function responseToError(response: Response, method: string, path: string): Promise<GitHubApiError> {
	const raw = await response.text().catch(() => "");
	let message = response.statusText || "Request failed";
	let documentationUrl: string | undefined;
	try {
		const parsed = JSON.parse(raw) as { message?: unknown; documentation_url?: unknown };
		if (typeof parsed.message === "string") message = parsed.message;
		if (typeof parsed.documentation_url === "string") documentationUrl = parsed.documentation_url;
	} catch {
		if (raw) message = raw;
	}
	message = sanitize(message).slice(0, MAX_ERROR_BODY_LENGTH);
	const rateLimit = readRateLimit(response.headers);
	const requestId = response.headers.get("x-github-request-id") ?? undefined;
	const actionable = rateLimit.remaining === 0
		? ` Rate limit exhausted${rateLimit.resetAt ? `; retry after ${rateLimit.resetAt}` : ""}.`
		: "";
	return new GitHubApiError({
		message: `GitHub API ${method} ${safePath(path)} failed (${response.status}): ${message}${actionable}`,
		method,
		path: safePath(path),
		status: response.status,
		requestId,
		documentationUrl,
		rateLimit,
		retryable: isRetrySafe(method) && isRetryableResponse(response.status, rateLimit),
	});
}

function readRateLimit(headers: Headers): GitHubRateLimit {
	const reset = numberHeader(headers, "x-ratelimit-reset");
	return {
		limit: numberHeader(headers, "x-ratelimit-limit"),
		remaining: numberHeader(headers, "x-ratelimit-remaining"),
		resetAt: reset === undefined ? undefined : new Date(reset * 1_000).toISOString(),
		retryAfterSeconds: numberHeader(headers, "retry-after"),
	};
}

function numberHeader(headers: Headers, name: string): number | undefined {
	const value = headers.get(name);
	if (value === null) return undefined;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function sanitize(value: string): string {
	return value
		.replace(/(bearer|token)\s+[A-Za-z0-9._~+\/-]+/gi, "$1 [REDACTED]")
		.replace(/gh[pousr]_[A-Za-z0-9_]+/g, "[REDACTED]")
		.replace(/[\r\n\t]+/g, " ");
}

function safePath(path: string): string {
	return path.replace(/([?&](?:access_token|token|client_secret)=)[^&]*/gi, "$1[REDACTED]");
}

function boundedInteger(value: number | undefined, fallback: number, min: number, max: number): number {
	if (value === undefined || !Number.isFinite(value)) return fallback;
	return Math.min(max, Math.max(min, Math.trunc(value)));
}

function stripUndefined<T>(value: T): T {
	if (Array.isArray(value)) return value.map(stripUndefined) as T;
	if (value && typeof value === "object") {
		return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined).map(([key, entry]) => [key, stripUndefined(entry)])) as T;
	}
	return value;
}
