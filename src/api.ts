import { resolveGitHubAuth } from "./auth.js";
import type {
  GitHubBranchProtectionInput,
  GitHubCreateRepoInput,
  GitHubDeleteCommentInput,
  GitHubEditCommentInput,
  GitHubIssueCommentInput,
  GitHubIssueInput,
  GitHubLabelInput,
  GitHubLinkPullRequestIssuesInput,
  GitHubMergePullRequestInput,
  GitHubMilestoneInput,
  GitHubPullRequestCommentInput,
  GitHubReleaseInput,
  GitHubRepoMetadataInput,
  GitHubRepoRef,
  GitHubShipRepoInput,
  GitHubVerifyInput,
} from "./types.js";

export function parseRepo(repo: string): GitHubRepoRef {
  const [owner, name] = repo.split("/");
  if (!owner || !name) throw new Error(`Invalid repo reference: ${repo}. Use owner/name.`);
  return { owner, name };
}

export function normalizeComparableText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function createOrGetRepo(input: GitHubCreateRepoInput) {
  const client = await createClient();
  const repoPath = `/repos/${input.owner}/${input.name}`;
  try {
    const existing = await client.request(repoPath);
    return {
      created: false,
      existed: true,
      dryRun: false,
      fullName: existing.full_name,
      url: existing.html_url,
    };
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }

  if (input.dryRun) {
    return {
      created: false,
      existed: false,
      dryRun: true,
      fullName: `${input.owner}/${input.name}`,
      url: `https://github.com/${input.owner}/${input.name}`,
      operation: "create_repo",
    };
  }

  const viewer = await client.request(`/user`);
  const createPath = viewer?.login === input.owner ? `/user/repos` : `/orgs/${input.owner}/repos`;
  const created = await client.request(createPath, "POST", {
    name: input.name,
    description: input.description,
    homepage: input.homepage,
    private: (input.visibility ?? "private") !== "public",
    auto_init: Boolean(input.initialize),
  });
  return {
    created: true,
    existed: false,
    dryRun: false,
    fullName: created.full_name,
    url: created.html_url,
  };
}

export async function setRepoMetadata(input: GitHubRepoMetadataInput) {
  const ref = parseRepo(input.repo);
  if (input.dryRun) {
    return {
      updated: false,
      verified: false,
      dryRun: true,
      repo: {
        fullName: `${ref.owner}/${ref.name}`,
        description: input.description,
        homepage: input.homepage,
        topics: input.topics ?? [],
      },
      operation: "set_repo_metadata",
    };
  }

  const client = await createClient();
  await client.request(`/repos/${ref.owner}/${ref.name}`, "PATCH", {
    description: input.description,
    homepage: input.homepage,
    has_issues: input.hasIssues,
    has_wiki: input.hasWiki,
  });
  if (input.topics) {
    await client.request(`/repos/${ref.owner}/${ref.name}/topics`, "PUT", { names: input.topics });
  }
  const repo = await client.request(`/repos/${ref.owner}/${ref.name}`);
  return {
    updated: true,
    verified: true,
    dryRun: false,
    repo: {
      fullName: repo.full_name,
      description: repo.description,
      homepage: repo.homepage,
      topics: repo.topics ?? input.topics ?? [],
    },
  };
}

export async function protectBranch(input: GitHubBranchProtectionInput) {
  if (input.dryRun) {
    return {
      updated: false,
      verified: false,
      dryRun: true,
      protection: {
        branch: input.branch,
        requiredChecks: input.requiredChecks ?? [],
        requirePullRequest: Boolean(input.requirePullRequest),
      },
      operation: "protect_branch",
    };
  }

  const ref = parseRepo(input.repo);
  const client = await createClient();
  const protection = await client.request(`/repos/${ref.owner}/${ref.name}/branches/${encodeURIComponent(input.branch)}/protection`, "PUT", {
    required_status_checks: {
      strict: true,
      contexts: input.requiredChecks ?? [],
    },
    enforce_admins: Boolean(input.applyToAdmins),
    required_pull_request_reviews: input.requirePullRequest
      ? {
          dismiss_stale_reviews: false,
          require_code_owner_reviews: false,
          required_approving_review_count: Math.max(0, input.requiredApprovals ?? 1),
        }
      : null,
    restrictions: null,
    allow_force_pushes: Boolean(input.allowForcePushes),
    allow_deletions: Boolean(input.allowDeletions),
    required_conversation_resolution: Boolean(input.requireConversationResolution),
    block_creations: false,
    lock_branch: false,
    allow_fork_syncing: false,
  });
  return {
    updated: true,
    verified: true,
    dryRun: false,
    protection,
  };
}

export async function createOrUpdateLabels(repo: string, labels: GitHubLabelInput[], dryRun = false) {
  if (dryRun) {
    return { created: [], updated: [], dryRun: true, labels };
  }

  const ref = parseRepo(repo);
  const client = await createClient();
  const created: string[] = [];
  const updated: string[] = [];

  for (const label of labels) {
    try {
      await client.request(`/repos/${ref.owner}/${ref.name}/labels/${encodeURIComponent(label.name)}`, "PATCH", {
        new_name: label.name,
        color: label.color,
        description: label.description,
      });
      updated.push(label.name);
    } catch (error) {
      if (!isNotFound(error)) throw error;
      await client.request(`/repos/${ref.owner}/${ref.name}/labels`, "POST", label);
      created.push(label.name);
    }
  }

  return { created, updated, dryRun: false };
}

export async function createOrGetMilestone(input: GitHubMilestoneInput) {
  const ref = parseRepo(input.repo);
  const client = await createClient();
  const milestones = (await client.request(`/repos/${ref.owner}/${ref.name}/milestones?state=all&per_page=100`)) as Array<{
    number: number;
    title: string;
    html_url: string;
  }>;
  const existing = milestones.find((m) => normalizeComparableText(m.title) === normalizeComparableText(input.title));
  if (existing) {
    return { created: false, number: existing.number, title: existing.title, url: existing.html_url, dryRun: false };
  }
  if (input.dryRun) {
    return {
      created: false,
      number: undefined,
      title: input.title,
      url: `https://github.com/${input.repo}/milestones`,
      dryRun: true,
    };
  }
  const milestone = await client.request(`/repos/${ref.owner}/${ref.name}/milestones`, "POST", {
    title: input.title,
    description: input.description,
  });
  return { created: true, number: milestone.number, title: milestone.title, url: milestone.html_url, dryRun: false };
}

export async function createOrGetIssue(input: GitHubIssueInput) {
  const ref = parseRepo(input.repo);
  const client = await createClient();
  const issues = (await client.request(`/repos/${ref.owner}/${ref.name}/issues?state=all&per_page=100`)) as Array<{
    number: number;
    title: string;
    body?: string;
    html_url: string;
    pull_request?: unknown;
  }>;
  const existing = findMatchingIssue(issues, input.title, input.body, Boolean(input.matchTitleOnly));
  if (existing) {
    return { created: false, number: existing.number, url: existing.html_url, dryRun: false, match: "existing" };
  }

  if (input.dryRun) {
    return {
      created: false,
      number: undefined,
      url: `https://github.com/${input.repo}/issues`,
      dryRun: true,
      match: "none",
    };
  }

  const milestoneNumber = input.milestone ? await resolveMilestoneNumber(client, ref, input.milestone) : undefined;
  const issue = await client.request(`/repos/${ref.owner}/${ref.name}/issues`, "POST", {
    title: input.title,
    body: input.body,
    labels: input.labels,
    milestone: milestoneNumber,
  });
  return { created: true, number: issue.number, url: issue.html_url, dryRun: false, match: "none" };
}

export async function linkPullRequestIssues(input: GitHubLinkPullRequestIssuesInput) {
  if (!input.issueNumbers.length) throw new Error("At least one issue number is required.");
  const ref = parseRepo(input.repo);
  const client = await createClient();
  const pull = (await client.request(`/repos/${ref.owner}/${ref.name}/pulls/${input.pullNumber}`)) as {
    number: number;
    body?: string | null;
    html_url: string;
  };

  if (input.requireExistingIssues ?? true) {
    for (const issueNumber of input.issueNumbers) {
      const issue = (await client.request(`/repos/${ref.owner}/${ref.name}/issues/${issueNumber}`)) as { pull_request?: unknown };
      if (issue.pull_request) throw new Error(`#${issueNumber} is a pull request, not an issue.`);
    }
  }

  const before = pull.body ?? "";
  const after = addIssueLinksToPrBody(before, input.issueNumbers, input.keyword ?? "closes", input.sectionTitle ?? "Issue asociado");
  if (before === after) {
    return { updated: false, dryRun: Boolean(input.dryRun), pullNumber: pull.number, url: pull.html_url, body: before };
  }
  if (input.dryRun) {
    return { updated: false, dryRun: true, pullNumber: pull.number, url: pull.html_url, body: after };
  }

  const updated = (await client.request(`/repos/${ref.owner}/${ref.name}/pulls/${input.pullNumber}`, "PATCH", { body: after })) as {
    number: number;
    body?: string | null;
    html_url: string;
  };
  return { updated: true, dryRun: false, pullNumber: updated.number, url: updated.html_url, body: updated.body ?? "" };
}

export async function mergePullRequestWhenReady(input: GitHubMergePullRequestInput) {
  const ref = parseRepo(input.repo);
  const client = await createClient();
  const pull = (await client.request(`/repos/${ref.owner}/${ref.name}/pulls/${input.pullNumber}`)) as {
    number: number;
    state: string;
    merged: boolean;
    mergeable_state?: string;
    html_url: string;
    head: { ref: string; sha: string; repo?: { full_name?: string } | null };
  };

  if (pull.state !== "open") {
    return { merged: pull.merged, skipped: true, reason: `Pull request is ${pull.state}.`, pullNumber: pull.number, url: pull.html_url };
  }
  if ((input.requireClean ?? true) && pull.mergeable_state && !["clean", "unstable", "has_hooks"].includes(pull.mergeable_state)) {
    throw new Error(`Pull request #${pull.number} is not merge-ready: ${pull.mergeable_state}.`);
  }

  const checks = input.requireChecksSuccess ?? true ? await getCheckRunSummary(client, ref, pull.head.sha) : undefined;
  if (checks && !checks.ok) {
    throw new Error(`Required checks are not successful for PR #${pull.number}: ${checks.failed.join(", ") || "pending checks"}.`);
  }

  if (input.dryRun) {
    return { merged: false, dryRun: true, pullNumber: pull.number, url: pull.html_url, mergeableState: pull.mergeable_state, checks };
  }

  const result = (await client.request(`/repos/${ref.owner}/${ref.name}/pulls/${input.pullNumber}/merge`, "PUT", {
    merge_method: input.method ?? "squash",
  })) as { merged: boolean; message: string; sha?: string };

  let deletedBranch = false;
  if (result.merged && input.deleteBranch && pull.head.repo?.full_name === `${ref.owner}/${ref.name}`) {
    await client.request(`/repos/${ref.owner}/${ref.name}/git/refs/heads/${encodeURIComponent(pull.head.ref)}`, "DELETE");
    deletedBranch = true;
  }

  return { merged: result.merged, dryRun: false, pullNumber: pull.number, url: pull.html_url, sha: result.sha, message: result.message, deletedBranch, checks };
}

export async function createIssueComment(input: GitHubIssueCommentInput) {
  return createDiscussionComment({
    repo: input.repo,
    number: input.issueNumber,
    kind: "issue",
    body: input.body,
    dryRun: input.dryRun,
  });
}

export async function createPullRequestComment(input: GitHubPullRequestCommentInput) {
  return createDiscussionComment({
    repo: input.repo,
    number: input.pullNumber,
    kind: "pull",
    body: input.body,
    dryRun: input.dryRun,
  });
}

export async function editComment(input: GitHubEditCommentInput) {
  const ref = parseRepo(input.repo);
  if (input.dryRun) {
    return {
      updated: false,
      dryRun: true,
      commentId: input.commentId,
      url: `https://github.com/${input.repo}`,
      operation: "edit_comment",
    };
  }

  const client = await createClient();
  const comment = await client.request(`/repos/${ref.owner}/${ref.name}/issues/comments/${input.commentId}`, "PATCH", {
    body: input.body,
  });
  return {
    updated: true,
    dryRun: false,
    commentId: input.commentId,
    url: comment.html_url,
  };
}

export async function deleteComment(input: GitHubDeleteCommentInput) {
  const ref = parseRepo(input.repo);
  if (input.dryRun) {
    return {
      deleted: false,
      dryRun: true,
      commentId: input.commentId,
      operation: "delete_comment",
    };
  }

  const client = await createClient();
  await client.request(`/repos/${ref.owner}/${ref.name}/issues/comments/${input.commentId}`, "DELETE");
  return {
    deleted: true,
    dryRun: false,
    commentId: input.commentId,
  };
}

export async function createOrUpdateRelease(input: GitHubReleaseInput) {
  const ref = parseRepo(input.repo);
  const client = await createClient();
  const releases = (await client.request(`/repos/${ref.owner}/${ref.name}/releases?per_page=100`)) as Array<{
    id: number;
    tag_name: string;
    name?: string;
    body?: string;
    html_url: string;
  }>;
  const existing = findMatchingRelease(releases, input.tag, input.title, input.notes, Boolean(input.matchTitleOnly));
  if (existing) {
    if (input.dryRun) {
      return { created: false, updated: false, dryRun: true, url: existing.html_url, match: "existing" };
    }
    const updated = await client.request(`/repos/${ref.owner}/${ref.name}/releases/${existing.id}`, "PATCH", {
      tag_name: input.tag,
      target_commitish: input.target,
      name: input.title,
      body: input.notes,
      draft: Boolean(input.draft),
      prerelease: Boolean(input.prerelease),
    });
    return { created: false, updated: true, dryRun: false, url: updated.html_url, match: "existing" };
  }
  if (input.dryRun) {
    return {
      created: false,
      updated: false,
      dryRun: true,
      url: `https://github.com/${input.repo}/releases`,
      match: "none",
    };
  }
  const release = await client.request(`/repos/${ref.owner}/${ref.name}/releases`, "POST", {
    tag_name: input.tag,
    target_commitish: input.target,
    name: input.title,
    body: input.notes,
    draft: Boolean(input.draft),
    prerelease: Boolean(input.prerelease),
  });
  return { created: true, updated: false, dryRun: false, url: release.html_url, match: "none" };
}

export async function verifyRepoState(input: GitHubVerifyInput) {
  const ref = parseRepo(input.repo);
  const client = await createClient();
  const results: Record<string, boolean> = {};
  const details: Record<string, unknown> = {};

  for (const check of input.checks) {
    if (check === "metadata") {
      const repo = await client.request(`/repos/${ref.owner}/${ref.name}`);
      results[check] = Boolean(repo?.full_name);
      details[check] = {
        fullName: repo?.full_name,
        visibility: repo?.visibility,
        hasIssues: repo?.has_issues,
        hasWiki: repo?.has_wiki,
        topics: repo?.topics ?? [],
      };
    } else if (check === "branch_protection") {
      const branch = input.branch || "main";
      const protection = await client.request(`/repos/${ref.owner}/${ref.name}/branches/${encodeURIComponent(branch)}/protection`);
      results[check] = Boolean(protection?.url);
      details[check] = {
        branch,
        requiredChecks: protection?.required_status_checks?.contexts ?? [],
        enforceAdmins: protection?.enforce_admins?.enabled ?? false,
        conversationResolution: protection?.required_conversation_resolution?.enabled ?? false,
      };
    } else if (check === "labels") {
      const labels = await client.request(`/repos/${ref.owner}/${ref.name}/labels?per_page=100`);
      results[check] = Array.isArray(labels);
      details[check] = { count: Array.isArray(labels) ? labels.length : 0 };
    } else if (check === "milestones") {
      const milestones = await client.request(`/repos/${ref.owner}/${ref.name}/milestones?state=all&per_page=100`);
      results[check] = Array.isArray(milestones);
      details[check] = { count: Array.isArray(milestones) ? milestones.length : 0 };
    } else if (check === "issues") {
      const issues = await client.request(`/repos/${ref.owner}/${ref.name}/issues?state=all&per_page=100`);
      const filtered = Array.isArray(issues) ? issues.filter((issue: any) => !issue.pull_request) : [];
      results[check] = Array.isArray(issues);
      details[check] = { count: filtered.length };
    } else if (check === "releases") {
      const releases = await client.request(`/repos/${ref.owner}/${ref.name}/releases?per_page=100`);
      const tagMatched = input.releaseTag ? Array.isArray(releases) && releases.some((r: any) => r.tag_name === input.releaseTag) : true;
      results[check] = Array.isArray(releases) && tagMatched;
      details[check] = {
        count: Array.isArray(releases) ? releases.length : 0,
        releaseTag: input.releaseTag,
        tagMatched,
      };
    }
  }

  return { ok: Object.values(results).every(Boolean), results, details };
}

export async function shipRepo(input: GitHubShipRepoInput) {
  const dryRun = Boolean(input.dryRun || input.repo.dryRun);
  const repoResult = await createOrGetRepo({ ...input.repo, dryRun });
  const repo = `${input.repo.owner}/${input.repo.name}`;

  const metadata = input.metadata ? await setRepoMetadata({ repo, ...input.metadata, dryRun }) : undefined;
  const labels = input.labels?.length ? await createOrUpdateLabels(repo, input.labels, dryRun) : undefined;
  const milestones = input.milestones?.length
    ? await Promise.all(input.milestones.map((milestone) => createOrGetMilestone({ repo, ...milestone, dryRun })))
    : [];
  const issues = input.issues?.length
    ? await Promise.all(input.issues.map((issue) => createOrGetIssue({ repo, ...issue, dryRun })))
    : [];
  const branchProtection = input.branchProtection
    ? await protectBranch({ repo, ...input.branchProtection, dryRun })
    : undefined;
  const release = input.release ? await createOrUpdateRelease({ repo, ...input.release, dryRun }) : undefined;
  const verify = input.verify ? (dryRun ? { ok: true, dryRun: true, checks: input.verify.checks } : await verifyRepoState({ repo, ...input.verify })) : undefined;

  return {
    ok: dryRun ? true : Boolean(repoResult && (verify?.ok ?? true)),
    dryRun,
    repo,
    repoResult,
    metadata,
    labels,
    milestones,
    issues,
    branchProtection,
    release,
    verify,
  };
}

export function findMatchingIssue<T extends { title: string; body?: string; pull_request?: unknown }>(
  issues: T[],
  title: string,
  body: string,
  matchTitleOnly: boolean,
): T | undefined {
  const normalizedTitle = normalizeComparableText(title);
  const normalizedBody = normalizeComparableText(body);
  return issues.find((issue) => {
    if (issue.pull_request) return false;
    if (normalizeComparableText(issue.title) !== normalizedTitle) return false;
    return matchTitleOnly || normalizeComparableText(issue.body ?? "") === normalizedBody;
  });
}

export function findMatchingRelease<T extends { tag_name: string; name?: string; body?: string }>(
  releases: T[],
  tag: string,
  title: string,
  notes: string,
  matchTitleOnly: boolean,
): T | undefined {
  const normalizedTitle = normalizeComparableText(title);
  const normalizedNotes = normalizeComparableText(notes);
  return releases.find((release) => {
    if (release.tag_name === tag) return true;
    if (normalizeComparableText(release.name ?? "") !== normalizedTitle) return false;
    return matchTitleOnly || normalizeComparableText(release.body ?? "") === normalizedNotes;
  });
}

export function addIssueLinksToPrBody(body: string, issueNumbers: number[], keyword: "closes" | "refs", sectionTitle = "Issue asociado"): string {
  const uniqueIssueNumbers = [...new Set(issueNumbers)];
  const missing = uniqueIssueNumbers.filter((issueNumber) => !new RegExp(`(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?|refs?)\\s+#${issueNumber}\\b`, "i").test(body));
  if (!missing.length) return body;

  const normalizedKeyword = keyword === "closes" ? "Closes" : "Refs";
  const lines = [`## ${sectionTitle}`, "", ...missing.map((issueNumber) => `${normalizedKeyword} #${issueNumber}`)];
  const trimmed = body.trimEnd();
  return trimmed ? `${trimmed}\n\n${lines.join("\n")}\n` : `${lines.join("\n")}\n`;
}

async function getCheckRunSummary(client: Awaited<ReturnType<typeof createClient>>, ref: GitHubRepoRef, sha: string) {
  const checkRunResponse = (await client.request(`/repos/${ref.owner}/${ref.name}/commits/${sha}/check-runs?per_page=100`)) as {
    check_runs?: Array<{ name: string; status: string; conclusion: string | null }>;
  };
  const statusResponse = (await client.request(`/repos/${ref.owner}/${ref.name}/commits/${sha}/status`)) as {
    state?: string;
    statuses?: Array<{ context: string; state: string }>;
  };

  const checkRuns = checkRunResponse.check_runs ?? [];
  const statuses = statusResponse.statuses ?? [];
  const failedChecks = checkRuns
    .filter((check) => check.status !== "completed" || !["success", "skipped", "neutral"].includes(check.conclusion ?? ""))
    .map((check) => `${check.name}:${check.status}/${check.conclusion ?? "pending"}`);
  const failedStatuses = statuses
    .filter((status) => status.state !== "success")
    .map((status) => `${status.context}:${status.state}`);
  const failed = [
    ...failedChecks,
    ...(statusResponse.state && statusResponse.state !== "success" ? [`combined-status:${statusResponse.state}`] : []),
    ...failedStatuses,
  ];

  return { ok: failed.length === 0, total: checkRuns.length + statuses.length, checkRuns: checkRuns.length, statuses: statuses.length, combinedStatus: statusResponse.state, failed };
}

async function resolveMilestoneNumber(client: Awaited<ReturnType<typeof createClient>>, ref: GitHubRepoRef, title: string) {
  const milestones = (await client.request(`/repos/${ref.owner}/${ref.name}/milestones?state=all&per_page=100`)) as Array<{
    number: number;
    title: string;
  }>;
  const match = milestones.find((m) => normalizeComparableText(m.title) === normalizeComparableText(title));
  if (!match) {
    throw new Error(`Milestone not found: ${title}`);
  }
  return match.number;
}

async function createDiscussionComment(input: {
  repo: string;
  number: number;
  kind: "issue" | "pull";
  body: string;
  dryRun?: boolean;
}) {
  const ref = parseRepo(input.repo);
  if (input.dryRun) {
    return {
      created: false,
      dryRun: true,
      issueNumber: input.kind === "issue" ? input.number : undefined,
      pullNumber: input.kind === "pull" ? input.number : undefined,
      url: `https://github.com/${input.repo}/${input.kind === "issue" ? "issues" : "pull"}/${input.number}`,
      commentId: undefined,
      operation: input.kind === "issue" ? "comment_issue" : "comment_pr",
    };
  }

  const client = await createClient();
  const comment = await client.request(`/repos/${ref.owner}/${ref.name}/issues/${input.number}/comments`, "POST", {
    body: input.body,
  });
  return {
    created: true,
    dryRun: false,
    issueNumber: input.kind === "issue" ? input.number : undefined,
    pullNumber: input.kind === "pull" ? input.number : undefined,
    url: comment.html_url,
    commentId: comment.id,
  };
}

async function createClient() {
  const { token } = await resolveGitHubAuth();
  return {
    async request(path: string, method = "GET", body?: unknown) {
      const response = await fetch(`https://api.github.com${path}`, {
        method,
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "User-Agent": "pi-github-admin",
          "X-GitHub-Api-Version": "2022-11-28",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(stripUndefined(body)) : undefined,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => response.statusText);
        const error = new Error(`GitHub API ${method} ${path} failed (${response.status}): ${text}`) as Error & {
          status?: number;
        };
        error.status = response.status;
        throw error;
      }

      if (response.status === 204) return {};
      return response.json();
    },
  };
}

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(stripUndefined) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).filter(([, v]) => v !== undefined).map(([k, v]) => [k, stripUndefined(v)]),
    ) as T;
  }
  return value;
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "status" in error && (error as { status?: number }).status === 404;
}
