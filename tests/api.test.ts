import { describe, expect, it } from "vitest";
import {
  addIssueLinksToPrBody,
  createIssueComment,
  createOrGetIssue,
  createOrGetMilestone,
  createOrGetRepo,
  createOrUpdateRelease,
  createPullRequestComment,
  deleteComment,
  editComment,
  findMatchingIssue,
  findMatchingRelease,
  normalizeComparableText,
  parseRepo,
  requirePrForMain,
  shipRepo,
  summarizeBranchComparison,
} from "../src/api.js";

describe("parseRepo", () => {
	it("parses owner/name", () => {
		expect(parseRepo("T50-Systems/pi-thread-goal")).toEqual({
			owner: "T50-Systems",
			name: "pi-thread-goal",
		});
	});

	it("throws on invalid repo", () => {
		expect(() => parseRepo("pi-thread-goal")).toThrow(/Invalid repo reference/);
	});

  it.each(["owner/repo/extra", "/repo", "owner/", " owner/repo", "owner/repo "])(
    "rejects malformed repo reference %s",
    (repo) => {
      expect(() => parseRepo(repo)).toThrow(/Invalid repo reference/);
    },
  );
});

describe("requirePrForMain", () => {
	it("applies the PR-only no-review branch protection preset", async () => {
		const result = await requirePrForMain({
			repo: "T50-Systems/pi-thread-goal",
			dryRun: true,
		});

		expect(result).toMatchObject({
			dryRun: true,
			preset: "pr-only-no-review",
			repo: "T50-Systems/pi-thread-goal",
			branch: "main",
			protection: {
				branch: "main",
				requirePullRequest: true,
			},
		});
	});
});

describe("normalizeComparableText", () => {
	it("normalizes case and whitespace", () => {
		expect(normalizeComparableText("  Hello   WORLD  ")).toBe("hello world");
	});
});

describe("findMatchingIssue", () => {
	it("matches normalized title and body", () => {
		const match = findMatchingIssue(
			[{ title: "Add  Repo", body: "Line one\nLine two" }],
			"add repo",
			"Line one Line two",
			false,
		);
		expect(match).toBeTruthy();
	});

	it("can match title only", () => {
		const match = findMatchingIssue(
			[{ title: "Add Repo", body: "older body" }],
			"add repo",
			"new body",
			true,
		);
		expect(match).toBeTruthy();
	});
});

describe("findMatchingRelease", () => {
	it("matches by tag first", () => {
		const match = findMatchingRelease(
			[{ tag_name: "v1.0.0", name: "release", body: "notes" }],
			"v1.0.0",
			"x",
			"y",
			false,
		);
		expect(match).toBeTruthy();
	});

	it("matches normalized title and notes", () => {
		const match = findMatchingRelease(
			[{ tag_name: "old", name: "Initial Release", body: "Some notes" }],
			"new",
			"initial   release",
			"some notes",
			false,
		);
		expect(match).toBeTruthy();
	});
});

describe("addIssueLinksToPrBody", () => {
	it("appends close links in a dedicated section", () => {
		const body = addIssueLinksToPrBody(
			"## Summary\nDone",
			[720, 548],
			"closes",
		);
		expect(body).toContain("## Issue asociado");
		expect(body).toContain("Closes #720");
		expect(body).toContain("Closes #548");
	});

	it("does not duplicate existing issue links", () => {
		const body = addIssueLinksToPrBody("Refs #548\n", [548], "refs");
		expect(body).toBe("Refs #548\n");
	});
});

describe("comment helpers", () => {
	it("supports issue comment dry run", async () => {
		const result = await createIssueComment({
			repo: "T50-Systems/repuestos",
			issueNumber: 218,
			body: "hello",
			dryRun: true,
		});
		expect(result.dryRun).toBe(true);
		expect(result.url).toBe(
			"https://github.com/T50-Systems/repuestos/issues/218",
		);
		expect(result.operation).toBe("comment_issue");
	});

	it("supports pr comment dry run", async () => {
		const result = await createPullRequestComment({
			repo: "T50-Systems/repuestos",
			pullNumber: 217,
			body: "hello",
			dryRun: true,
		});
		expect(result.dryRun).toBe(true);
		expect(result.url).toBe(
			"https://github.com/T50-Systems/repuestos/pull/217",
		);
		expect(result.operation).toBe("comment_pr");
	});

	it("supports edit comment dry run", async () => {
		const result = await editComment({
			repo: "T50-Systems/repuestos",
			commentId: 123,
			body: "updated",
			dryRun: true,
		});
		expect(result.dryRun).toBe(true);
		expect(result.operation).toBe("edit_comment");
	});

	it("supports delete comment dry run", async () => {
		const result = await deleteComment({
			repo: "T50-Systems/repuestos",
			commentId: 123,
			dryRun: true,
		});
		expect(result.dryRun).toBe(true);
		expect(result.operation).toBe("delete_comment");
	});
});

describe("summarizeBranchComparison", () => {
	it("treats behind branches as safe to delete", () => {
		expect(
			summarizeBranchComparison({
				status: "behind",
				behind_by: 3,
				total_commits: 3,
			}),
		).toMatchObject({
			status: "behind",
			safeToDelete: true,
			behindBy: 3,
		});
	});

	it("treats ahead branches as unsafe to delete", () => {
		expect(
			summarizeBranchComparison({
				status: "ahead",
				ahead_by: 2,
				total_commits: 2,
			}),
		).toMatchObject({
			status: "ahead",
			safeToDelete: false,
			aheadBy: 2,
		});
	});
});

describe("offline dry runs", () => {
  it("plans create operations without resolving auth or calling GitHub", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error("dry runs must not use fetch");
    };

    try {
      const [repo, milestone, issue, release] = await Promise.all([
        createOrGetRepo({ owner: "T50-Systems", name: "demo", dryRun: true }),
        createOrGetMilestone({ repo: "T50-Systems/demo", title: "v1", dryRun: true }),
        createOrGetIssue({
          repo: "T50-Systems/demo",
          title: "Example",
          body: "Body",
          dryRun: true,
        }),
        createOrUpdateRelease({
          repo: "T50-Systems/demo",
          tag: "v1.0.0",
          title: "v1.0.0",
          notes: "Notes",
          dryRun: true,
        }),
      ]);

      expect(repo).toMatchObject({ dryRun: true, operation: "create_repo" });
      expect(milestone).toMatchObject({ dryRun: true, title: "v1" });
      expect(issue).toMatchObject({ dryRun: true, match: "none" });
      expect(release).toMatchObject({ dryRun: true, match: "none" });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("plans the complete composite workflow offline", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error("dry runs must not use fetch");
    };

    try {
      const result = await shipRepo({
        repo: { owner: "T50-Systems", name: "demo", dryRun: true },
        metadata: { description: "Demo", topics: ["pi"] },
        labels: [{ name: "roadmap", color: "5319e7" }],
        milestones: [{ title: "Foundation" }],
        issues: [{ title: "First issue", body: "Body" }],
        branchProtection: { branch: "main", requirePullRequest: true },
        release: { tag: "v1.0.0", title: "v1.0.0", notes: "Notes" },
        verify: { checks: ["metadata", "issues", "releases"] },
      });

      expect(result).toMatchObject({
        ok: true,
        dryRun: true,
        repo: "T50-Systems/demo",
        verify: { ok: true, dryRun: true },
      });
      expect(result.issues).toHaveLength(1);
      expect(result.milestones).toHaveLength(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
