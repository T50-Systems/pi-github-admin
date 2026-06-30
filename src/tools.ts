import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { inspectGitHubAuth } from "./auth.js";
import {
  createOrGetIssue,
  createOrGetMilestone,
  createOrUpdateLabels,
  createOrUpdateRelease,
  protectBranch,
  setRepoMetadata,
  verifyRepoState,
} from "./api.js";

export function registerGitHubAdminTools(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "github_get_auth",
    label: "GitHub Get Auth",
    description: "Verify GitHub authentication available to Pi.",
    parameters: Type.Object({}, { additionalProperties: false }),
    async execute() {
      const auth = await inspectGitHubAuth();
      return {
        content: [{ type: "text", text: auth.authenticated ? formatAuth(auth) : "GitHub auth unavailable." }],
        details: auth,
      };
    },
  });

  pi.registerTool({
    name: "github_set_repo_metadata",
    label: "GitHub Set Repo Metadata",
    description: "Create or update GitHub repository description, homepage, topics, and feature flags.",
    parameters: Type.Object(
      {
        repo: Type.String(),
        description: Type.Optional(Type.String()),
        homepage: Type.Optional(Type.String()),
        topics: Type.Optional(Type.Array(Type.String())),
        hasIssues: Type.Optional(Type.Boolean()),
        hasWiki: Type.Optional(Type.Boolean()),
      },
      { additionalProperties: false },
    ),
    async execute(_id, params) {
      const result = await setRepoMetadata(params);
      return {
        content: [{ type: "text", text: `Repository metadata updated: ${result.repo.fullName}` }],
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
      },
      { additionalProperties: false },
    ),
    async execute(_id, params) {
      const result = await protectBranch(params);
      return {
        content: [{ type: "text", text: `Branch protection updated for ${params.repo}:${params.branch}` }],
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
      },
      { additionalProperties: false },
    ),
    async execute(_id, params) {
      const result = await createOrUpdateLabels(params.repo, params.labels);
      return {
        content: [{ type: "text", text: `Labels synced. Created: ${result.created.length}, updated: ${result.updated.length}` }],
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
      },
      { additionalProperties: false },
    ),
    async execute(_id, params) {
      const result = await createOrGetMilestone(params);
      return {
        content: [{ type: "text", text: `${result.created ? "Created" : "Found"} milestone: ${result.title}` }],
        details: result,
      };
    },
  });

  pi.registerTool({
    name: "github_create_issue",
    label: "GitHub Create Issue",
    description: "Create an issue with optional labels and milestone, reusing an existing issue with the same title if present.",
    parameters: Type.Object(
      {
        repo: Type.String(),
        title: Type.String(),
        body: Type.String(),
        labels: Type.Optional(Type.Array(Type.String())),
        milestone: Type.Optional(Type.String()),
      },
      { additionalProperties: false },
    ),
    async execute(_id, params) {
      const result = await createOrGetIssue(params);
      return {
        content: [{ type: "text", text: `${result.created ? "Created" : "Found"} issue #${result.number}` }],
        details: result,
      };
    },
  });

  pi.registerTool({
    name: "github_create_release",
    label: "GitHub Create Release",
    description: "Create or update a GitHub release for a tag.",
    parameters: Type.Object(
      {
        repo: Type.String(),
        tag: Type.String(),
        title: Type.String(),
        target: Type.Optional(Type.String()),
        notes: Type.String(),
        draft: Type.Optional(Type.Boolean()),
        prerelease: Type.Optional(Type.Boolean()),
      },
      { additionalProperties: false },
    ),
    async execute(_id, params) {
      const result = await createOrUpdateRelease(params);
      return {
        content: [{ type: "text", text: `${result.created ? "Created" : "Updated"} release for ${params.tag}` }],
        details: result,
      };
    },
  });

  pi.registerTool({
    name: "github_verify_repo_state",
    label: "GitHub Verify Repo State",
    description: "Verify final GitHub repo state across metadata, protection, milestones, issues, labels, and releases.",
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
        content: [{ type: "text", text: result.ok ? "Repository state verified." : "Repository verification found gaps." }],
        details: result,
      };
    },
  });
}

function formatAuth(auth: { login?: string; source?: string; scopes?: string[] }): string {
  return [
    `Authenticated as ${auth.login || "unknown"}`,
    auth.source ? `Source: ${auth.source}` : undefined,
    auth.scopes?.length ? `Scopes: ${auth.scopes.join(", ")}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}
