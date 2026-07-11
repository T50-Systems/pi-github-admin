import type { GitHubRepoRef } from "./types.js";

export function parseRepo(repo: string): GitHubRepoRef {
	const parts = repo.split("/");
	if (parts.length !== 2 || parts.some((part) => !part.trim() || part !== part.trim())) {
		throw new Error(`Invalid repo reference: ${repo}. Use owner/name.`);
	}
	return { owner: parts[0], name: parts[1] };
}
