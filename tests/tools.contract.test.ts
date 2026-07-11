import { afterEach, describe, expect, it, vi } from "vitest";
import { registerGitHubAdminTools, ALL_TOOL_NAMES } from "../src/tools.js";
import { setGitHubClientFactoryForTests, type GitHubClient } from "../src/http.js";

function collectTools() {
	const tools: any[] = [];
	registerGitHubAdminTools({ registerTool: (tool: any) => tools.push(tool) } as any);
	return tools;
}

afterEach(() => setGitHubClientFactoryForTests());

describe("Pi tool contracts", () => {
	it("registers every stable domain-catalog tool exactly once with a closed schema", () => {
		const tools = collectTools();
		expect(tools.map((tool) => tool.name).sort()).toEqual([...ALL_TOOL_NAMES].sort());
		expect(new Set(tools.map((tool) => tool.name)).size).toBe(tools.length);
		for (const tool of tools) {
			expect(tool.label).toBeTruthy();
			expect(tool.description).toBeTruthy();
			expect(tool.parameters.type).toBe("object");
			expect(tool.parameters.additionalProperties).toBe(false);
			expect(typeof tool.execute).toBe("function");
		}
	});

	it("maps every mutation tool schema to its offline handler", async () => {
		const tools = new Map(collectTools().map((tool) => [tool.name, tool]));
		const cases: Record<string, any> = {
			github_create_repo: { owner: "o", name: "r", dryRun: true },
			github_set_repo_metadata: { repo: "o/r", description: "x", dryRun: true },
			github_protect_branch: { repo: "o/r", branch: "main", dryRun: true },
			github_require_pr_for_main: { repo: "o/r", dryRun: true },
			github_create_labels: { repo: "o/r", labels: [{ name: "x", color: "ffffff" }], dryRun: true },
			github_create_milestone: { repo: "o/r", title: "m", dryRun: true },
			github_create_issue: { repo: "o/r", title: "i", body: "b", dryRun: true },
			github_link_pr_issues: { repo: "o/r", pullNumber: 1, issueNumbers: [2], dryRun: true },
			github_merge_pr_when_ready: { repo: "o/r", pullNumber: 1, dryRun: true },
			github_comment_issue: { repo: "o/r", issueNumber: 1, body: "x", dryRun: true },
			github_comment_pr: { repo: "o/r", pullNumber: 1, body: "x", dryRun: true },
			github_edit_comment: { repo: "o/r", commentId: 1, body: "x", dryRun: true },
			github_delete_comment: { repo: "o/r", commentId: 1, dryRun: true },
			github_delete_branch: { repo: "o/r", branch: "topic", dryRun: true },
			github_create_release: { repo: "o/r", tag: "v1", title: "v1", notes: "n", dryRun: true },
			github_ship_repo: { repo: { owner: "o", name: "r" }, dryRun: true },
			github_configure_security: { repo: "o/r", secretScanning: true, dryRun: true },
		};
		const fetchSpy = vi.spyOn(globalThis, "fetch");
		for (const [name, params] of Object.entries(cases)) {
			const result = await tools.get(name).execute("id", params);
			expect(result.details.dryRun, name).toBe(true);
			expect(result.content[0].type, name).toBe("text");
		}
		expect(fetchSpy).not.toHaveBeenCalled();
		fetchSpy.mockRestore();
	});

	it("executes every non-auth tool through the intended live handler", async () => {
		const tools = new Map(collectTools().map((tool) => [tool.name, tool]));
		const route = (path: string, method = "GET", body?: any): any => {
			if (path.includes("check-runs")) return { check_runs: [] };
			if (path.includes("/statuses")) return [];
			if (path.includes("?state=") || path.includes("?per_page=")) return [];
			if (path === "/repos/o/r/pulls/1") return method === "PATCH" ? { number: 1, html_url: "pr", body: body.body } : { number: 1, state: "open", merged: false, mergeable_state: "clean", html_url: "pr", body: "", head: { ref: "topic", sha: "abc", repo: { full_name: "o/r" } } };
			if (path.endsWith("/merge")) return { merged: true, message: "ok", sha: "m" };
			if (path.includes("/issues/2") && method === "GET") return {};
			if (path.endsWith("/comments") && method === "POST") return { id: 3, html_url: "c" };
			if (path.includes("issues/comments/3")) return { html_url: "c" };
			if (path.includes("/branches/topic")) return { name: "topic", commit: { sha: "abc" } };
			if (path.includes("/compare/")) return { status: "behind", behind_by: 1 };
			if (path.includes("/protection")) return { url: "p", required_status_checks: { contexts: [] }, enforce_admins: { enabled: false } };
			if (path.endsWith("/milestones") && method === "POST") return { number: 4, title: "m", html_url: "m" };
			if (path.endsWith("/issues") && method === "POST") return { number: 5, html_url: "i" };
			if (path.endsWith("/releases") && method === "POST") return { html_url: "rel" };
			if (path.endsWith("/labels/x")) return {};
			if (path.endsWith("/automated-security-fixes") || path.endsWith("/private-vulnerability-reporting")) return { enabled: true };
			if (path === "/repos/o/r") return { full_name: "o/r", html_url: "repo", default_branch: "main", security_and_analysis: { secret_scanning: { status: "enabled" }, secret_scanning_push_protection: { status: "enabled" }, secret_scanning_non_provider_patterns: { status: "enabled" }, secret_scanning_validity_checks: { status: "enabled" } } };
			return {};
		};
		const client = {
			request: vi.fn(async (path: string, method = "GET", body?: unknown) => route(path, method, body)),
			requestWithMeta: vi.fn(async (path: string, method = "GET", body?: unknown) => ({ data: route(path, method, body), status: 200, headers: new Headers() })),
		} as unknown as GitHubClient;
		setGitHubClientFactoryForTests(() => client);
		const cases: Record<string, any> = {
			github_create_repo: { owner: "o", name: "r" },
			github_set_repo_metadata: { repo: "o/r", description: "x" },
			github_protect_branch: { repo: "o/r", branch: "main" },
			github_require_pr_for_main: { repo: "o/r" },
			github_create_labels: { repo: "o/r", labels: [{ name: "x", color: "ffffff" }] },
			github_create_milestone: { repo: "o/r", title: "m" },
			github_create_issue: { repo: "o/r", title: "i", body: "b" },
			github_link_pr_issues: { repo: "o/r", pullNumber: 1, issueNumbers: [2] },
			github_merge_pr_when_ready: { repo: "o/r", pullNumber: 1 },
			github_comment_issue: { repo: "o/r", issueNumber: 2, body: "x" },
			github_comment_pr: { repo: "o/r", pullNumber: 1, body: "x" },
			github_edit_comment: { repo: "o/r", commentId: 3, body: "x" },
			github_delete_comment: { repo: "o/r", commentId: 3 },
			github_delete_branch: { repo: "o/r", branch: "topic" },
			github_list_prs: { repo: "o/r" },
			github_get_pr_checks: { repo: "o/r", pullNumber: 1 },
			github_create_release: { repo: "o/r", tag: "v1", title: "v1", notes: "n" },
			github_verify_repo_state: { repo: "o/r", checks: ["metadata", "branch_protection", "labels", "milestones", "issues", "releases"] },
			github_ship_repo: { repo: { owner: "o", name: "r" } },
			github_configure_security: { repo: "o/r", privateVulnerabilityReporting: true, secretScanning: true, pushProtection: true, nonProviderPatterns: true, validityChecks: true, dependabotSecurityUpdates: true },
			github_verify_security: { repo: "o/r" },
		};
		for (const [name, params] of Object.entries(cases)) {
			const result = await tools.get(name).execute("id", params);
			expect(result.content[0].type, name).toBe("text");
		}
	});
});
