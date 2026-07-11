import { afterEach, describe, expect, it, vi } from "vitest";
import {
	configureRepositorySecurity,
	createIssueComment,
	createOrGetIssue,
	createOrGetMilestone,
	createOrGetRepo,
	createOrUpdateLabels,
	createOrUpdateRelease,
	createPullRequestComment,
	deleteBranch,
	deleteComment,
	editComment,
	getPullRequestChecks,
	listPullRequests,
	linkPullRequestIssues,
	mergePullRequestWhenReady,
	protectBranch,
	requirePrForMain,
	setRepoMetadata,
	shipRepo,
	verifyRepositorySecurity,
} from "../src/index.js";
import { GitHubApiError, type GitHubClient, setGitHubClientFactoryForTests } from "../src/http.js";

const meta = <T>(data: T, link?: string) => ({ data, status: 200, headers: new Headers(link ? { link } : {}) });

function mockClient(handler: (path: string, method: string, body?: unknown) => any): GitHubClient {
	return {
		request: vi.fn(async (path: string, method = "GET", body?: unknown) => handler(path, method, body)),
		requestWithMeta: vi.fn(async (path: string, method = "GET", body?: unknown) => meta(await handler(path, method, body))),
	};
}

function install(client: GitHubClient) {
	const factory = vi.fn(async () => client);
	setGitHubClientFactoryForTests(factory);
	return factory;
}

afterEach(() => setGitHubClientFactoryForTests());

describe("offline mutation plans", () => {
	it("performs zero client/auth resolution for every mutating dry run", async () => {
		const factory = vi.fn(() => { throw new Error("must stay offline"); });
		setGitHubClientFactoryForTests(factory);
		const operations = [
			createOrGetRepo({ owner: "o", name: "r", dryRun: true }),
			setRepoMetadata({ repo: "o/r", description: "x", dryRun: true }),
			protectBranch({ repo: "o/r", branch: "main", dryRun: true }),
			requirePrForMain({ repo: "o/r", dryRun: true }),
			createOrUpdateLabels("o/r", [{ name: "x", color: "ffffff" }], true),
			createOrGetMilestone({ repo: "o/r", title: "m", dryRun: true }),
			createOrGetIssue({ repo: "o/r", title: "i", body: "b", dryRun: true }),
			linkPullRequestIssues({ repo: "o/r", pullNumber: 1, issueNumbers: [2], dryRun: true }),
			mergePullRequestWhenReady({ repo: "o/r", pullNumber: 1, dryRun: true }),
			createIssueComment({ repo: "o/r", issueNumber: 1, body: "x", dryRun: true }),
			createPullRequestComment({ repo: "o/r", pullNumber: 1, body: "x", dryRun: true }),
			editComment({ repo: "o/r", commentId: 1, body: "x", dryRun: true }),
			deleteComment({ repo: "o/r", commentId: 1, dryRun: true }),
			createOrUpdateRelease({ repo: "o/r", tag: "v1", title: "v1", notes: "n", dryRun: true }),
			deleteBranch({ repo: "o/r", branch: "topic", dryRun: true }),
			configureRepositorySecurity({ repo: "o/r", secretScanning: true, dryRun: true }),
			shipRepo({ repo: { owner: "o", name: "r" }, metadata: { description: "x" }, labels: [{ name: "x", color: "fff" }], milestones: [{ title: "m" }], issues: [{ title: "i", body: "b" }], branchProtection: { branch: "main" }, release: { tag: "v1", title: "v1", notes: "n" }, verify: { checks: ["metadata"] }, dryRun: true }),
		];
		const results = await Promise.all(operations);
		expect(results.every((result: any) => result.dryRun)).toBe(true);
		expect(factory).not.toHaveBeenCalled();
	});

	it("retains destructive refusal preconditions in dry runs", async () => {
		await expect(deleteBranch({ repo: "o/r", branch: "main", dryRun: true })).rejects.toThrow("Refusing to delete default branch");
		await expect(linkPullRequestIssues({ repo: "o/r", pullNumber: 1, issueNumbers: [], dryRun: true })).rejects.toThrow("At least one issue");
	});
});

describe("mocked mutation request paths", () => {
	it("covers repository creation and metadata request shapes", async () => {
		let missingOnce = true;
		const client = mockClient((path, method, body) => {
			if (path === "/repos/o/new" && method === "GET" && missingOnce) { missingOnce = false; throw Object.assign(new Error("missing"), { status: 404 }); }
			if (path === "/user") return { login: "o" };
			if (path === "/user/repos") return { full_name: "o/new", html_url: "https://github.com/o/new" };
			if (method === "PATCH") return {};
			if (path.endsWith("/topics") && method === "PUT") return {};
			return { full_name: "o/new", description: "desc", homepage: "https://x", topics: ["pi"] };
		});
		install(client);
		await expect(createOrGetRepo({ owner: "o", name: "new", initialize: true })).resolves.toMatchObject({ created: true });
		await expect(setRepoMetadata({ repo: "o/new", description: "desc", homepage: "https://x", topics: ["pi"] })).resolves.toMatchObject({ updated: true, verified: true });
		expect(client.request).toHaveBeenCalledWith("/user/repos", "POST", expect.objectContaining({ name: "new", auto_init: true }));
		expect(client.request).toHaveBeenCalledWith("/repos/o/new", "PATCH", expect.objectContaining({ description: "desc" }));
	});

	it("covers protection, labels, milestones, and issues", async () => {
		const client = mockClient((path, method, body) => {
			if (path.includes("/labels/existing")) return {};
			if (path.includes("/labels/missing")) throw Object.assign(new Error("missing"), { status: 404 });
			if (path.endsWith("/labels") && method === "POST") return body;
			if (path.includes("milestones") && method === "POST") return { number: 4, title: "M", html_url: "m" };
			if (path.endsWith("/issues") && method === "POST") return { number: 5, html_url: "i" };
			if (path.includes("/protection")) return { url: "p" };
			return [];
		});
		install(client);
		await expect(protectBranch({ repo: "o/r", branch: "main", requirePullRequest: true, requiredApprovals: 2 })).resolves.toMatchObject({ updated: true });
		await expect(createOrUpdateLabels("o/r", [{ name: "existing", color: "fff" }, { name: "missing", color: "000" }])).resolves.toEqual({ created: ["missing"], updated: ["existing"], dryRun: false });
		await expect(createOrGetMilestone({ repo: "o/r", title: "M" })).resolves.toMatchObject({ created: true, number: 4 });
		await expect(createOrGetIssue({ repo: "o/r", title: "I", body: "B" })).resolves.toMatchObject({ created: true, number: 5 });
		expect(client.request).toHaveBeenCalledWith(expect.stringContaining("/protection"), "PUT", expect.objectContaining({ required_pull_request_reviews: expect.any(Object) }));
	});

	it("finds page-two milestone and release duplicates", async () => {
		const client = {
			request: vi.fn(async () => ({ html_url: "r2" })),
			requestWithMeta: vi.fn(async (path: string) => {
				if (path.includes("page=2") && path.includes("milestones")) return meta([{ number: 2, title: "Target", html_url: "m2" }]);
				if (path.includes("milestones")) return meta([], '<https://api.github.com/repos/o/r/milestones?state=all&per_page=100&page=2>; rel="next"');
				if (path.includes("page=2") && path.includes("releases")) return meta([{ id: 2, tag_name: "v2", name: "v2", body: "notes", html_url: "r2" }]);
				return meta([], '<https://api.github.com/repos/o/r/releases?per_page=100&page=2>; rel="next"');
			}),
		} as unknown as GitHubClient;
		install(client);
		await expect(createOrGetMilestone({ repo: "o/r", title: "Target" })).resolves.toMatchObject({ created: false, number: 2 });
		await expect(createOrUpdateRelease({ repo: "o/r", tag: "v2", title: "v2", notes: "notes" })).resolves.toMatchObject({ updated: true, match: "existing" });
		expect(client.request).toHaveBeenCalledWith("/repos/o/r/releases/2", "PATCH", expect.objectContaining({ tag_name: "v2" }));
	});

	it("covers PR links, comments, merge, and branch deletion", async () => {
		const client = mockClient((path, method, body) => {
			if (path === "/repos/o/r/pulls/1" && method === "GET") return { number: 1, state: "open", merged: false, mergeable_state: "clean", html_url: "pr", body: "summary", head: { ref: "topic", sha: "abc", repo: { full_name: "o/r" } } };
			if (path === "/repos/o/r/pulls/1" && method === "PATCH") return { number: 1, html_url: "pr", body: (body as any).body };
			if (path.endsWith("/merge")) return { merged: true, message: "ok", sha: "merged" };
			if (path.includes("check-runs")) return { check_runs: [] };
			if (path.includes("/statuses")) return [];
			if (path.includes("/issues/2") && method === "GET") return {};
			if (path.endsWith("/comments") && method === "POST") return { id: 9, html_url: "comment" };
			if (path.includes("issues/comments/9") && method === "PATCH") return { html_url: "comment" };
			if (path === "/repos/o/r") return { default_branch: "main", html_url: "repo" };
			if (path.includes("/branches/topic")) return { name: "topic", commit: { sha: "abc" }, protected: false };
			if (path.includes("/compare/")) return { status: "behind", behind_by: 1 };
			return {};
		});
		install(client);
		await expect(linkPullRequestIssues({ repo: "o/r", pullNumber: 1, issueNumbers: [2] })).resolves.toMatchObject({ updated: true });
		await expect(createIssueComment({ repo: "o/r", issueNumber: 2, body: "x" })).resolves.toMatchObject({ created: true, commentId: 9 });
		await expect(createPullRequestComment({ repo: "o/r", pullNumber: 1, body: "x" })).resolves.toMatchObject({ created: true });
		await expect(editComment({ repo: "o/r", commentId: 9, body: "edit" })).resolves.toMatchObject({ updated: true });
		await expect(deleteComment({ repo: "o/r", commentId: 9 })).resolves.toMatchObject({ deleted: true });
		await expect(mergePullRequestWhenReady({ repo: "o/r", pullNumber: 1, deleteBranch: true })).resolves.toMatchObject({ merged: true, deletedBranch: true });
		await expect(deleteBranch({ repo: "o/r", branch: "topic" })).resolves.toMatchObject({ deleted: true });
		expect(client.request).toHaveBeenCalledWith("/repos/o/r/git/refs/heads/topic", "DELETE");
	});

	it("refuses destructive operations when preconditions fail", async () => {
		const client = mockClient((path) => {
			if (path === "/repos/o/r") return { default_branch: "main" };
			if (path.includes("/branches/topic")) return { name: "topic" };
			if (path.includes("/compare/")) return { status: "ahead", ahead_by: 1 };
			if (path.includes("/pulls/1")) return { number: 1, state: "open", merged: false, mergeable_state: "dirty", html_url: "pr", head: { ref: "topic", sha: "a" } };
			return {};
		});
		install(client);
		await expect(deleteBranch({ repo: "o/r", branch: "main" })).rejects.toThrow("Refusing to delete default branch");
		await expect(deleteBranch({ repo: "o/r", branch: "topic" })).rejects.toThrow("unique commits");
		await expect(mergePullRequestWhenReady({ repo: "o/r", pullNumber: 1 })).rejects.toThrow("not merge-ready");
	});

	it("configures and verifies every supported security control", async () => {
		const client = mockClient((path, method) => {
			if (path === "/repos/o/r" && method === "GET") return { security_and_analysis: {
				secret_scanning: { status: "enabled" }, secret_scanning_push_protection: { status: "enabled" },
				secret_scanning_non_provider_patterns: { status: "enabled" }, secret_scanning_validity_checks: { status: "enabled" },
			} };
			if (method === "GET") return { enabled: true };
			return {};
		});
		install(client);
		const input = { repo: "o/r", privateVulnerabilityReporting: true, secretScanning: true, pushProtection: true, nonProviderPatterns: true, validityChecks: true, dependabotSecurityUpdates: true };
		await expect(configureRepositorySecurity(input)).resolves.toMatchObject({ updated: true, verified: true });
		await expect(verifyRepositorySecurity({ repo: "o/r" })).resolves.toMatchObject({ ok: true });
		expect(client.request).toHaveBeenCalledWith("/repos/o/r/private-vulnerability-reporting", "PUT");
		expect(client.request).toHaveBeenCalledWith("/repos/o/r/automated-security-fixes", "PUT");
		expect(client.request).toHaveBeenCalledWith("/repos/o/r", "PATCH", expect.objectContaining({ security_and_analysis: expect.any(Object) }));
	});

	it("includes page-two check failures and reports list truncation", async () => {
		const client = {
			request: vi.fn(async (path: string) => path.includes("/pulls/1") ? { number: 1, state: "open", merged: false, mergeable_state: "clean", html_url: "pr", head: { sha: "abc", ref: "topic" } } : []),
			requestWithMeta: vi.fn(async (path: string) => {
				if (path.includes("check-runs") && path.includes("page=2")) return meta({ check_runs: [{ name: "late", status: "completed", conclusion: "failure" }] });
				if (path.includes("check-runs")) return meta({ check_runs: Array.from({ length: 100 }, (_, index) => ({ name: `ok-${index}`, status: "completed", conclusion: "success" })) }, '<https://api.github.com/repos/o/r/commits/abc/check-runs?per_page=100&page=2>; rel="next"');
				if (path.includes("/statuses")) return meta([]);
				return meta([{ number: 1, state: "open", title: "PR", html_url: "pr" }], '<https://api.github.com/repos/o/r/pulls?state=open&per_page=1&page=2>; rel="next"');
			}),
		} as unknown as GitHubClient;
		install(client);
		await expect(getPullRequestChecks({ repo: "o/r", pullNumber: 1 })).resolves.toMatchObject({ ok: false, checks: { checkRuns: 101, failed: ["late:completed/failure"] } });
		await expect(listPullRequests({ repo: "o/r", limit: 1 })).resolves.toMatchObject({ count: 1, limit: 1, truncated: true });
	});

	it("surfaces authorization, not-found, conflict, and partial composite failures", async () => {
		for (const status of [401, 404, 409]) {
			const error = new GitHubApiError({ message: `status ${status}`, method: "PATCH", path: "/repos/o/r", status });
			install(mockClient(() => { throw error; }));
			await expect(setRepoMetadata({ repo: "o/r", description: "x" })).rejects.toMatchObject({ status });
		}
		let calls = 0;
		install(mockClient((path, method) => {
			calls += 1;
			if (path === "/repos/o/r" && method === "GET") throw Object.assign(new Error("missing"), { status: 404 });
			if (path === "/user") return { login: "o" };
			if (path === "/user/repos") return { full_name: "o/r", html_url: "repo" };
			throw new GitHubApiError({ message: "partial", method, path, status: 422 });
		}));
		await expect(shipRepo({ repo: { owner: "o", name: "r" }, metadata: { description: "fails" } })).rejects.toMatchObject({ status: 422 });
		expect(calls).toBeGreaterThan(2);
	});
});
