import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GitHubAuthInfo } from "./types.js";

const execFileAsync = promisify(execFile);

export async function resolveGitHubAuth(): Promise<{ token: string; info: GitHubAuthInfo }> {
  const envToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (envToken) {
    const login = await getViewerLogin(envToken).catch(() => undefined);
    return {
      token: envToken,
      info: {
        authenticated: true,
        login,
        source: "env",
      },
    };
  }

  const token = await readGhToken();
  const login = await getViewerLogin(token).catch(() => undefined);
  return {
    token,
    info: {
      authenticated: true,
      login,
      source: "gh",
    },
  };
}

export async function inspectGitHubAuth(repo?: string): Promise<GitHubAuthInfo> {
  try {
    const { info, token } = await resolveGitHubAuth();
    const scopes = await getTokenScopes(token).catch(() => []);
    const repoAccess = repo ? await getRepoAccess(token, repo).catch(() => undefined) : undefined;
    return {
      ...info,
      scopes,
      repoAccess,
      message: info.login ? `Authenticated as ${info.login}.` : "Authenticated with GitHub.",
      suggestions: scopes.length === 0 ? ["If operations fail, verify the token has repo access."] : undefined,
    };
  } catch (error) {
    return {
      authenticated: false,
      message: error instanceof Error ? error.message : "GitHub auth unavailable.",
      suggestions: [
        "Set GITHUB_TOKEN or GH_TOKEN.",
        "Or run: gh auth login",
        "Then retry github_get_auth.",
      ],
    };
  }
}

async function readGhToken(): Promise<string> {
  try {
    const { stdout } = await execFileAsync("gh", ["auth", "token"], { timeout: 5000 });
    const token = stdout.trim();
    if (!token) throw new Error("Empty token from gh auth token.");
    return token;
  } catch (error) {
    throw new Error(
      `No GitHub auth available. Set GITHUB_TOKEN/GH_TOKEN or login via gh. ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function getViewerLogin(token: string): Promise<string | undefined> {
  const response = await fetch("https://api.github.com/user", {
    headers: buildHeaders(token),
  });
  if (!response.ok) return undefined;
  const data = (await response.json()) as { login?: string };
  return data.login;
}

async function getTokenScopes(token: string): Promise<string[]> {
  const response = await fetch("https://api.github.com/user", {
    headers: buildHeaders(token),
  });
  const raw = response.headers.get("x-oauth-scopes") || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function getRepoAccess(token: string, repo: string): Promise<NonNullable<GitHubAuthInfo["repoAccess"]>> {
  const response = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: buildHeaders(token),
  });
  if (response.status === 404) {
    return { repo, exists: false };
  }
  if (!response.ok) {
    throw new Error(`Unable to inspect repo access for ${repo} (${response.status}).`);
  }
  const data = (await response.json()) as {
    permissions?: {
      admin?: boolean;
      maintain?: boolean;
      push?: boolean;
      triage?: boolean;
      pull?: boolean;
    };
  };
  return {
    repo,
    exists: true,
    permissions: data.permissions,
  };
}

function buildHeaders(token: string): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "pi-github-admin",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}
