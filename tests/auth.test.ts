import { afterEach, describe, expect, it, vi } from "vitest";
import { inspectGitHubAuth, resolveGitHubAuth } from "../src/auth.js";

const originalGitHubToken = process.env.GITHUB_TOKEN;
const originalGhToken = process.env.GH_TOKEN;

afterEach(() => {
  if (originalGitHubToken === undefined) delete process.env.GITHUB_TOKEN;
  else process.env.GITHUB_TOKEN = originalGitHubToken;
  if (originalGhToken === undefined) delete process.env.GH_TOKEN;
  else process.env.GH_TOKEN = originalGhToken;
  vi.unstubAllGlobals();
});

describe("GitHub authentication", () => {
  it("prefers GITHUB_TOKEN over GH_TOKEN", async () => {
    process.env.GITHUB_TOKEN = "primary-token";
    process.env.GH_TOKEN = "secondary-token";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ login: "operator" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveGitHubAuth();

    expect(result).toMatchObject({
      token: "primary-token",
      info: { authenticated: true, login: "operator", source: "env" },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/user",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer primary-token" }),
      }),
    );
  });

  it("reports useful auth diagnostics without returning the token", async () => {
    process.env.GITHUB_TOKEN = "secret-token";
    delete process.env.GH_TOKEN;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ login: "operator" }), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "x-oauth-scopes": "repo, workflow",
          },
        }),
      ),
    );

    const result = await inspectGitHubAuth();

    expect(result).toMatchObject({
      authenticated: true,
      login: "operator",
      source: "env",
      scopes: ["repo", "workflow"],
    });
    expect(JSON.stringify(result)).not.toContain("secret-token");
  });
});
