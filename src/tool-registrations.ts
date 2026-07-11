import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { inspectGitHubAuth } from "./auth.js";
import {
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
	linkPullRequestIssues,
	listPullRequests,
	mergePullRequestWhenReady,
	requirePrForMain,
	protectBranch,
	setRepoMetadata,
	shipRepo,
	verifyRepoState,
} from "./api.js";

function registerCoreToolDefinitions(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "github_get_auth",
		label: "GitHub Get Auth",
		description:
			"Verify GitHub authentication available to Pi and optionally inspect access to a repository.",
		parameters: Type.Object(
			{
				repo: Type.Optional(Type.String()),
			},
			{ additionalProperties: false },
		),
		async execute(_id, params) {
			const auth = await inspectGitHubAuth(params.repo);
			return {
				content: [{ type: "text", text: formatAuth(auth) }],
				details: auth,
			};
		},
	});

	pi.registerTool({
		name: "github_create_repo",
		label: "GitHub Create Repo",
		description: "Create a GitHub repository if it does not already exist.",
		parameters: Type.Object(
			{
				owner: Type.String(),
				name: Type.String(),
				description: Type.Optional(Type.String()),
				visibility: Type.Optional(
					Type.Union([Type.Literal("public"), Type.Literal("private")]),
				),
				homepage: Type.Optional(Type.String()),
				initialize: Type.Optional(Type.Boolean()),
				dryRun: Type.Optional(Type.Boolean()),
			},
			{ additionalProperties: false },
		),
		async execute(_id, params) {
			const result = await createOrGetRepo(params);
			return {
				content: [
					{
						type: "text",
						text: result.dryRun
							? `Dry run: would create ${result.fullName}`
							: `${result.created ? "Created" : "Found"} repo ${result.fullName}`,
					},
				],
				details: result,
			};
		},
	});

	pi.registerTool({
		name: "github_set_repo_metadata",
		label: "GitHub Set Repo Metadata",
		description:
			"Create or update GitHub repository description, homepage, topics, and feature flags.",
		parameters: Type.Object(
			{
				repo: Type.String(),
				description: Type.Optional(Type.String()),
				homepage: Type.Optional(Type.String()),
				topics: Type.Optional(Type.Array(Type.String())),
				hasIssues: Type.Optional(Type.Boolean()),
				hasWiki: Type.Optional(Type.Boolean()),
				dryRun: Type.Optional(Type.Boolean()),
			},
			{ additionalProperties: false },
		),
		async execute(_id, params) {
			const result = await setRepoMetadata(params);
			return {
				content: [
					{
						type: "text",
						text: result.dryRun
							? `Dry run: would update metadata for ${params.repo}`
							: `Repository metadata updated: ${result.repo.fullName}`,
					},
				],
				details: result,
			};
		},
	});

	pi.registerTool({
		name: "github_protect_branch",
		label: "GitHub Protect Branch",
		description: "Apply declarative branch protection to a GitHub branch.",
		parameters: Type.Object(
			{
				repo: Type.String(),
				branch: Type.String(),
				requiredChecks: Type.Optional(Type.Array(Type.String())),
				requirePullRequest: Type.Optional(Type.Boolean()),
				requiredApprovals: Type.Optional(Type.Number()),
				requireConversationResolution: Type.Optional(Type.Boolean()),
				allowForcePushes: Type.Optional(Type.Boolean()),
				allowDeletions: Type.Optional(Type.Boolean()),
				applyToAdmins: Type.Optional(Type.Boolean()),
				dryRun: Type.Optional(Type.Boolean()),
			},
			{ additionalProperties: false },
		),
		async execute(_id, params) {
			const result = await protectBranch(params);
			return {
				content: [
					{
						type: "text",
						text: result.dryRun
							? `Dry run: would protect ${params.repo}:${params.branch}`
							: `Branch protection updated for ${params.repo}:${params.branch}`,
					},
				],
				details: result,
			};
		},
	});

	pi.registerTool({
		name: "github_require_pr_for_main",
		label: "GitHub Require PR For Main",
		description:
			"Shortcut: protect main so it can only be merged through a pull request, without requiring reviews.",
		parameters: Type.Object(
			{
				repo: Type.String(),
				branch: Type.Optional(Type.String()),
				dryRun: Type.Optional(Type.Boolean()),
			},
			{ additionalProperties: false },
		),
		async execute(_id, params) {
			const result = await requirePrForMain(params);
			return {
				content: [
					{
						type: "text",
						text: result.dryRun
							? `Dry run: would require PR-only merges without reviews for ${params.repo}:${params.branch ?? "main"}`
							: `PR-only branch protection enabled without required reviews for ${params.repo}:${params.branch ?? "main"}`,
					},
				],
				details: result,
			};
		},
	});

	pi.registerTool({
		name: "github_create_labels",
		label: "GitHub Create Labels",
		description: "Create or update GitHub issue labels.",
		parameters: Type.Object(
			{
				repo: Type.String(),
				labels: Type.Array(
					Type.Object(
						{
							name: Type.String(),
							color: Type.String(),
							description: Type.Optional(Type.String()),
						},
						{ additionalProperties: false },
					),
				),
				dryRun: Type.Optional(Type.Boolean()),
			},
			{ additionalProperties: false },
		),
		async execute(_id, params) {
			const result = await createOrUpdateLabels(
				params.repo,
				params.labels,
				params.dryRun,
			);
			return {
				content: [
					{
						type: "text",
						text: result.dryRun
							? `Dry run: would sync ${params.labels.length} labels`
							: `Labels synced. Created: ${result.created.length}, updated: ${result.updated.length}`,
					},
				],
				details: result,
			};
		},
	});

	pi.registerTool({
		name: "github_create_milestone",
		label: "GitHub Create Milestone",
		description: "Create a milestone if it does not already exist.",
		parameters: Type.Object(
			{
				repo: Type.String(),
				title: Type.String(),
				description: Type.Optional(Type.String()),
				dryRun: Type.Optional(Type.Boolean()),
			},
			{ additionalProperties: false },
		),
		async execute(_id, params) {
			const result = await createOrGetMilestone(params);
			return {
				content: [
					{
						type: "text",
						text: result.dryRun
							? `Dry run: would create milestone ${params.title}`
							: `${result.created ? "Created" : "Found"} milestone: ${result.title}`,
					},
				],
				details: result,
			};
		},
	});

	pi.registerTool({
		name: "github_create_issue",
		label: "GitHub Create Issue",
		description:
			"Create an issue with optional labels and milestone, reusing an existing issue when its normalized title and body already match.",
		parameters: Type.Object(
			{
				repo: Type.String(),
				title: Type.String(),
				body: Type.String(),
				labels: Type.Optional(Type.Array(Type.String())),
				milestone: Type.Optional(Type.String()),
				matchTitleOnly: Type.Optional(Type.Boolean()),
				dryRun: Type.Optional(Type.Boolean()),
			},
			{ additionalProperties: false },
		),
		async execute(_id, params) {
			const result = await createOrGetIssue(params);
			return {
				content: [
					{
						type: "text",
						text: result.dryRun
							? `Dry run: would create issue ${params.title}`
							: `${result.created ? "Created" : "Found"} issue${result.number ? ` #${result.number}` : ""}`,
					},
				],
				details: result,
			};
		},
	});

	pi.registerTool({
		name: "github_link_pr_issues",
		label: "GitHub Link PR Issues",
		description:
			"Append existing issue references to a pull request body with duplicate detection; use before merging so work remains traceable.",
		parameters: Type.Object(
			{
				repo: Type.String(),
				pullNumber: Type.Number(),
				issueNumbers: Type.Array(Type.Number()),
				keyword: Type.Optional(
					Type.Union([Type.Literal("closes"), Type.Literal("refs")]),
				),
				sectionTitle: Type.Optional(Type.String()),
				requireExistingIssues: Type.Optional(Type.Boolean()),
				dryRun: Type.Optional(Type.Boolean()),
			},
			{ additionalProperties: false },
		),
		async execute(_id, params) {
			const result = await linkPullRequestIssues(params);
			return {
				content: [
					{
						type: "text",
						text: result.dryRun
							? `Dry run: would link issues on PR #${params.pullNumber}`
							: `${result.updated ? "Updated" : "Already linked"} PR #${params.pullNumber}`,
					},
				],
				details: result,
			};
		},
	});

	pi.registerTool({
		name: "github_merge_pr_when_ready",
		label: "GitHub Merge PR When Ready",
		description:
			"Merge a pull request only after clean mergeability and successful checks criteria are satisfied; optionally delete the source branch.",
		parameters: Type.Object(
			{
				repo: Type.String(),
				pullNumber: Type.Number(),
				method: Type.Optional(
					Type.Union([
						Type.Literal("merge"),
						Type.Literal("squash"),
						Type.Literal("rebase"),
					]),
				),
				deleteBranch: Type.Optional(Type.Boolean()),
				requireClean: Type.Optional(Type.Boolean()),
				requireChecksSuccess: Type.Optional(Type.Boolean()),
				dryRun: Type.Optional(Type.Boolean()),
			},
			{ additionalProperties: false },
		),
		async execute(_id, params) {
			const result = await mergePullRequestWhenReady(params);
			return {
				content: [
					{
						type: "text",
						text: result.dryRun
							? `Dry run: PR #${params.pullNumber} is mergeable by criteria`
							: result.merged
								? `Merged PR #${params.pullNumber}`
								: `Skipped PR #${params.pullNumber}`,
					},
				],
				details: result,
			};
		},
	});

	pi.registerTool({
		name: "github_comment_issue",
		label: "GitHub Comment Issue",
		description: "Create a comment on an existing GitHub issue.",
		parameters: Type.Object(
			{
				repo: Type.String(),
				issueNumber: Type.Number(),
				body: Type.String(),
				dryRun: Type.Optional(Type.Boolean()),
			},
			{ additionalProperties: false },
		),
		async execute(_id, params) {
			const result = await createIssueComment(params);
			return {
				content: [
					{
						type: "text",
						text: result.dryRun
							? `Dry run: would comment on issue #${params.issueNumber}`
							: `Commented on issue #${params.issueNumber}`,
					},
				],
				details: result,
			};
		},
	});

	pi.registerTool({
		name: "github_comment_pr",
		label: "GitHub Comment PR",
		description:
			"Create a comment on an existing GitHub pull request conversation.",
		parameters: Type.Object(
			{
				repo: Type.String(),
				pullNumber: Type.Number(),
				body: Type.String(),
				dryRun: Type.Optional(Type.Boolean()),
			},
			{ additionalProperties: false },
		),
		async execute(_id, params) {
			const result = await createPullRequestComment(params);
			return {
				content: [
					{
						type: "text",
						text: result.dryRun
							? `Dry run: would comment on PR #${params.pullNumber}`
							: `Commented on PR #${params.pullNumber}`,
					},
				],
				details: result,
			};
		},
	});

	pi.registerTool({
		name: "github_edit_comment",
		label: "GitHub Edit Comment",
		description:
			"Edit an existing GitHub issue or pull request comment by comment id.",
		parameters: Type.Object(
			{
				repo: Type.String(),
				commentId: Type.Number(),
				body: Type.String(),
				dryRun: Type.Optional(Type.Boolean()),
			},
			{ additionalProperties: false },
		),
		async execute(_id, params) {
			const result = await editComment(params);
			return {
				content: [
					{
						type: "text",
						text: result.dryRun
							? `Dry run: would edit comment ${params.commentId}`
							: `Edited comment ${params.commentId}`,
					},
				],
				details: result,
			};
		},
	});

	pi.registerTool({
		name: "github_delete_comment",
		label: "GitHub Delete Comment",
		description:
			"Delete an existing GitHub issue or pull request comment by comment id.",
		parameters: Type.Object(
			{
				repo: Type.String(),
				commentId: Type.Number(),
				dryRun: Type.Optional(Type.Boolean()),
			},
			{ additionalProperties: false },
		),
		async execute(_id, params) {
			const result = await deleteComment(params);
			return {
				content: [
					{
						type: "text",
						text: result.dryRun
							? `Dry run: would delete comment ${params.commentId}`
							: `Deleted comment ${params.commentId}`,
					},
				],
				details: result,
			};
		},
	});

	pi.registerTool({
		name: "github_delete_branch",
		label: "GitHub Delete Branch",
		description:
			"Delete a GitHub branch safely, with optional merged-only checks against the default or provided base branch.",
		parameters: Type.Object(
			{
				repo: Type.String(),
				branch: Type.String(),
				baseBranch: Type.Optional(Type.String()),
				requireMerged: Type.Optional(Type.Boolean()),
				allowDefaultBranch: Type.Optional(Type.Boolean()),
				dryRun: Type.Optional(Type.Boolean()),
			},
			{ additionalProperties: false },
		),
		async execute(_id, params) {
			const result = await deleteBranch(params);
			return {
				content: [
					{
						type: "text",
						text: result.dryRun
							? `Dry run: would delete branch ${params.repo}:${params.branch}`
							: `Deleted branch ${params.repo}:${params.branch}`,
					},
				],
				details: result,
			};
		},
	});

	pi.registerTool({
		name: "github_list_prs",
		label: "GitHub List PRs",
		description:
			"List pull requests for a repository, similar to `gh pr list --repo ...`.",
		parameters: Type.Object(
			{
				repo: Type.String(),
				state: Type.Optional(
					Type.Union([
						Type.Literal("open"),
						Type.Literal("closed"),
						Type.Literal("all"),
					]),
				),
				base: Type.Optional(Type.String()),
				head: Type.Optional(Type.String()),
				limit: Type.Optional(Type.Number()),
			},
			{ additionalProperties: false },
		),
		async execute(_id, params) {
			const result = await listPullRequests(params);
			return {
				content: [
					{
						type: "text",
						text: `Found ${result.count} pull request(s) in ${params.repo}`,
					},
				],
				details: result,
			};
		},
	});

	pi.registerTool({
		name: "github_get_pr_checks",
		label: "GitHub Get PR Checks",
		description:
			"Inspect the current check-run and status summary for a pull request, similar to `gh pr checks`.",
		parameters: Type.Object(
			{
				repo: Type.String(),
				pullNumber: Type.Number(),
			},
			{ additionalProperties: false },
		),
		async execute(_id, params) {
			const result = await getPullRequestChecks(params);
			return {
				content: [
					{
						type: "text",
						text: result.ok
							? `PR #${params.pullNumber} checks are passing`
							: `PR #${params.pullNumber} has failing or pending checks`,
					},
				],
				details: result,
			};
		},
	});

	pi.registerTool({
		name: "github_create_release",
		label: "GitHub Create Release",
		description:
			"Create or update a GitHub release for a tag, with duplicate matching by tag or normalized title/body.",
		parameters: Type.Object(
			{
				repo: Type.String(),
				tag: Type.String(),
				title: Type.String(),
				target: Type.Optional(Type.String()),
				notes: Type.String(),
				draft: Type.Optional(Type.Boolean()),
				prerelease: Type.Optional(Type.Boolean()),
				matchTitleOnly: Type.Optional(Type.Boolean()),
				dryRun: Type.Optional(Type.Boolean()),
			},
			{ additionalProperties: false },
		),
		async execute(_id, params) {
			const result = await createOrUpdateRelease(params);
			return {
				content: [
					{
						type: "text",
						text: result.dryRun
							? `Dry run: would create/update release ${params.tag}`
							: `${result.created ? "Created" : "Updated"} release for ${params.tag}`,
					},
				],
				details: result,
			};
		},
	});

	pi.registerTool({
		name: "github_verify_repo_state",
		label: "GitHub Verify Repo State",
		description:
			"Verify final GitHub repo state across metadata, protection, milestones, issues, labels, and releases with richer detail output.",
		parameters: Type.Object(
			{
				repo: Type.String(),
				checks: Type.Array(
					Type.Union([
						Type.Literal("metadata"),
						Type.Literal("branch_protection"),
						Type.Literal("labels"),
						Type.Literal("milestones"),
						Type.Literal("issues"),
						Type.Literal("releases"),
					]),
				),
				branch: Type.Optional(Type.String()),
				releaseTag: Type.Optional(Type.String()),
			},
			{ additionalProperties: false },
		),
		async execute(_id, params) {
			const result = await verifyRepoState(params);
			return {
				content: [
					{
						type: "text",
						text: result.ok
							? "Repository state verified."
							: "Repository verification found gaps.",
					},
				],
				details: result,
			};
		},
	});

	pi.registerTool({
		name: "github_ship_repo",
		label: "GitHub Ship Repo",
		description:
			"Bootstrap a GitHub repo end-to-end in one declarative call: create repo, set metadata, add labels/milestones/issues, protect the branch, optionally release, and verify.",
		parameters: Type.Object(
			{
				repo: Type.Object(
					{
						owner: Type.String(),
						name: Type.String(),
						description: Type.Optional(Type.String()),
						visibility: Type.Optional(
							Type.Union([Type.Literal("public"), Type.Literal("private")]),
						),
						homepage: Type.Optional(Type.String()),
						initialize: Type.Optional(Type.Boolean()),
					},
					{ additionalProperties: false },
				),
				metadata: Type.Optional(
					Type.Object(
						{
							description: Type.Optional(Type.String()),
							homepage: Type.Optional(Type.String()),
							topics: Type.Optional(Type.Array(Type.String())),
							hasIssues: Type.Optional(Type.Boolean()),
							hasWiki: Type.Optional(Type.Boolean()),
						},
						{ additionalProperties: false },
					),
				),
				labels: Type.Optional(
					Type.Array(
						Type.Object(
							{
								name: Type.String(),
								color: Type.String(),
								description: Type.Optional(Type.String()),
							},
							{ additionalProperties: false },
						),
					),
				),
				milestones: Type.Optional(
					Type.Array(
						Type.Object(
							{
								title: Type.String(),
								description: Type.Optional(Type.String()),
							},
							{ additionalProperties: false },
						),
					),
				),
				issues: Type.Optional(
					Type.Array(
						Type.Object(
							{
								title: Type.String(),
								body: Type.String(),
								labels: Type.Optional(Type.Array(Type.String())),
								milestone: Type.Optional(Type.String()),
								matchTitleOnly: Type.Optional(Type.Boolean()),
							},
							{ additionalProperties: false },
						),
					),
				),
				branchProtection: Type.Optional(
					Type.Object(
						{
							branch: Type.String(),
							requiredChecks: Type.Optional(Type.Array(Type.String())),
							requirePullRequest: Type.Optional(Type.Boolean()),
							requiredApprovals: Type.Optional(Type.Number()),
							requireConversationResolution: Type.Optional(Type.Boolean()),
							allowForcePushes: Type.Optional(Type.Boolean()),
							allowDeletions: Type.Optional(Type.Boolean()),
							applyToAdmins: Type.Optional(Type.Boolean()),
						},
						{ additionalProperties: false },
					),
				),
				release: Type.Optional(
					Type.Object(
						{
							tag: Type.String(),
							title: Type.String(),
							target: Type.Optional(Type.String()),
							notes: Type.String(),
							draft: Type.Optional(Type.Boolean()),
							prerelease: Type.Optional(Type.Boolean()),
							matchTitleOnly: Type.Optional(Type.Boolean()),
						},
						{ additionalProperties: false },
					),
				),
				verify: Type.Optional(
					Type.Object(
						{
							checks: Type.Array(
								Type.Union([
									Type.Literal("metadata"),
									Type.Literal("branch_protection"),
									Type.Literal("labels"),
									Type.Literal("milestones"),
									Type.Literal("issues"),
									Type.Literal("releases"),
								]),
							),
							branch: Type.Optional(Type.String()),
							releaseTag: Type.Optional(Type.String()),
						},
						{ additionalProperties: false },
					),
				),
				dryRun: Type.Optional(Type.Boolean()),
			},
			{ additionalProperties: false },
		),
		async execute(_id, params) {
			const result = await shipRepo(params);
			return {
				content: [
					{
						type: "text",
						text: result.dryRun
							? `Dry run prepared for ${result.repo}`
							: `Repo workflow completed for ${result.repo}`,
					},
				],
				details: result,
			};
		},
	});
}

export function registerSelectedToolDefinitions(
	pi: ExtensionAPI,
	names: readonly string[],
): void {
	const selected = new Set(names);
	const filteredPi = new Proxy(pi as object, {
		get(target, property, receiver) {
			if (property === "registerTool") {
				return (tool: { name: string }) => {
					if (selected.has(tool.name)) pi.registerTool(tool as any);
				};
			}
			return Reflect.get(target, property, receiver);
		},
	}) as ExtensionAPI;
	registerCoreToolDefinitions(filteredPi);
}

function formatAuth(auth: {
	authenticated?: boolean;
	login?: string;
	source?: string;
	scopes?: string[];
	message?: string;
	suggestions?: string[];
	repoAccess?: {
		repo: string;
		exists: boolean;
		permissions?: Record<string, boolean | undefined>;
	};
}): string {
	if (!auth.authenticated) {
		return [
			auth.message || "GitHub auth unavailable.",
			...(auth.suggestions ?? []),
		].join("\n");
	}

	const lines = [
		auth.message || `Authenticated as ${auth.login || "unknown"}`,
		auth.source ? `Source: ${auth.source}` : undefined,
		auth.scopes?.length
			? `Scopes: ${auth.scopes.join(", ")}`
			: "Scopes: unavailable",
	];

	if (auth.repoAccess) {
		lines.push(
			auth.repoAccess.exists
				? `Repo access ${auth.repoAccess.repo}: ${
						Object.entries(auth.repoAccess.permissions ?? {})
							.filter(([, value]) => value)
							.map(([key]) => key)
							.join(", ") || "no explicit permissions reported"
					}`
				: `Repo access ${auth.repoAccess.repo}: repo not found or inaccessible`,
		);
	}

	if (auth.suggestions?.length) lines.push(...auth.suggestions);
	return lines.filter(Boolean).join("\n");
}
