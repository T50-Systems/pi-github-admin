import { resolveGitHubAuth } from "./auth.js";
import type {
  GitHubBranchProtectionInput,
  GitHubIssueInput,
  GitHubLabelInput,
  GitHubMilestoneInput,
  GitHubReleaseInput,
  GitHubRepoMetadataInput,
  GitHubRepoRef,
  GitHubVerifyInput,
} from "./types.js";

export function parseRepo(repo: string): GitHubRepoRef {
  const [owner, name] = repo.split("/");
  if (!owner || !name) throw new Error(`Invalid repo reference: ${repo}. Use owner/name.`);
  return { owner, name };
}

export async function setRepoMetadata(input: GitHubRepoMetadataInput) {
  const ref = parseRepo(input.repo);
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
    repo: {
      fullName: repo.full_name,
      description: repo.description,
      homepage: repo.homepage,
      topics: repo.topics ?? input.topics ?? [],
    },
  };
}

export async function protectBranch(input: GitHubBranchProtectionInput) {
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
    protection,
  };
}

export async function createOrUpdateLabels(repo: string, labels: GitHubLabelInput[]) {
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

  return { created, updated };
}

export async function createOrGetMilestone(input: GitHubMilestoneInput) {
  const ref = parseRepo(input.repo);
  const client = await createClient();
  const milestones = (await client.request(`/repos/${ref.owner}/${ref.name}/milestones?state=all&per_page=100`)) as Array<{
    number: number;
    title: string;
    html_url: string;
  }>;
  const existing = milestones.find((m) => m.title === input.title);
  if (existing) {
    return { created: false, number: existing.number, title: existing.title, url: existing.html_url };
  }
  const milestone = await client.request(`/repos/${ref.owner}/${ref.name}/milestones`, "POST", {
    title: input.title,
    description: input.description,
  });
  return { created: true, number: milestone.number, title: milestone.title, url: milestone.html_url };
}

export async function createOrGetIssue(input: GitHubIssueInput) {
  const ref = parseRepo(input.repo);
  const client = await createClient();
  const issues = (await client.request(`/repos/${ref.owner}/${ref.name}/issues?state=all&per_page=100`)) as Array<{
    number: number;
    title: string;
    html_url: string;
    pull_request?: unknown;
  }>;
  const existing = issues.find((issue) => !issue.pull_request && issue.title === input.title);
  if (existing) {
    return { created: false, number: existing.number, url: existing.html_url };
  }

  const milestoneNumber = input.milestone ? await resolveMilestoneNumber(client, ref, input.milestone) : undefined;
  const issue = await client.request(`/repos/${ref.owner}/${ref.name}/issues`, "POST", {
    title: input.title,
    body: input.body,
    labels: input.labels,
    milestone: milestoneNumber,
  });
  return { created: true, number: issue.number, url: issue.html_url };
}

export async function createOrUpdateRelease(input: GitHubReleaseInput) {
  const ref = parseRepo(input.repo);
  const client = await createClient();
  const releases = (await client.request(`/repos/${ref.owner}/${ref.name}/releases?per_page=100`)) as Array<{
    id: number;
    tag_name: string;
    html_url: string;
  }>;
  const existing = releases.find((release) => release.tag_name === input.tag);
  if (existing) {
    const updated = await client.request(`/repos/${ref.owner}/${ref.name}/releases/${existing.id}`, "PATCH", {
      tag_name: input.tag,
      target_commitish: input.target,
      name: input.title,
      body: input.notes,
      draft: Boolean(input.draft),
      prerelease: Boolean(input.prerelease),
    });
    return { created: false, updated: true, url: updated.html_url };
  }
  const release = await client.request(`/repos/${ref.owner}/${ref.name}/releases`, "POST", {
    tag_name: input.tag,
    target_commitish: input.target,
    name: input.title,
    body: input.notes,
    draft: Boolean(input.draft),
    prerelease: Boolean(input.prerelease),
  });
  return { created: true, updated: false, url: release.html_url };
}

export async function verifyRepoState(input: GitHubVerifyInput) {
  const ref = parseRepo(input.repo);
  const client = await createClient();
  const results: Record<string, boolean> = {};

  for (const check of input.checks) {
    if (check === "metadata") {
      const repo = await client.request(`/repos/${ref.owner}/${ref.name}`);
      results[check] = Boolean(repo?.full_name);
    } else if (check === "branch_protection") {
      const branch = input.branch || "main";
      const protection = await client.request(`/repos/${ref.owner}/${ref.name}/branches/${encodeURIComponent(branch)}/protection`);
      results[check] = Boolean(protection?.url);
    } else if (check === "labels") {
      const labels = await client.request(`/repos/${ref.owner}/${ref.name}/labels?per_page=100`);
      results[check] = Array.isArray(labels);
    } else if (check === "milestones") {
      const milestones = await client.request(`/repos/${ref.owner}/${ref.name}/milestones?state=all&per_page=100`);
      results[check] = Array.isArray(milestones);
    } else if (check === "issues") {
      const issues = await client.request(`/repos/${ref.owner}/${ref.name}/issues?state=all&per_page=100`);
      results[check] = Array.isArray(issues);
    } else if (check === "releases") {
      const releases = await client.request(`/repos/${ref.owner}/${ref.name}/releases?per_page=100`);
      results[check] = Array.isArray(releases) && (input.releaseTag ? releases.some((r: any) => r.tag_name === input.releaseTag) : true);
    }
  }

  return { ok: Object.values(results).every(Boolean), results };
}

async function resolveMilestoneNumber(client: Awaited<ReturnType<typeof createClient>>, ref: GitHubRepoRef, title: string) {
  const milestones = (await client.request(`/repos/${ref.owner}/${ref.name}/milestones?state=all&per_page=100`)) as Array<{
    number: number;
    title: string;
  }>;
  const match = milestones.find((m) => m.title === title);
  if (!match) {
    throw new Error(`Milestone not found: ${title}`);
  }
  return match.number;
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
