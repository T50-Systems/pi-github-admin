import { getGitHubClient } from "./http.js";
import type { GitHubSecurityControlsInput, GitHubVerifySecurityControlsInput } from "./types.js";
import { parseRepo } from "./repo-ref.js";

export interface RepositorySecurityState {
	privateVulnerabilityReporting: boolean;
	secretScanning: boolean;
	pushProtection: boolean;
	nonProviderPatterns: boolean;
	validityChecks: boolean;
	dependabotSecurityUpdates: boolean;
}

export async function configureRepositorySecurity(input: GitHubSecurityControlsInput) {
	const requested = normalizeRequested(input);
	if (input.dryRun) {
		return { updated: false, verified: false, dryRun: true, repo: input.repo, requested, operation: "configure_repository_security" };
	}
	const ref = parseRepo(input.repo);
	const client = await getGitHubClient();
	if (input.privateVulnerabilityReporting !== undefined) {
		await client.request(
			`/repos/${ref.owner}/${ref.name}/private-vulnerability-reporting`,
			input.privateVulnerabilityReporting ? "PUT" : "DELETE",
		);
	}
	const analysisEntries = Object.entries({
		secret_scanning: input.secretScanning,
		secret_scanning_push_protection: input.pushProtection,
		secret_scanning_non_provider_patterns: input.nonProviderPatterns,
		secret_scanning_validity_checks: input.validityChecks,
	}).filter(([, value]) => value !== undefined);
	if (analysisEntries.length) {
		await client.request(`/repos/${ref.owner}/${ref.name}`, "PATCH", {
			security_and_analysis: Object.fromEntries(
				analysisEntries.map(([key, value]) => [key, { status: value ? "enabled" : "disabled" }]),
			),
		});
	}
	if (input.dependabotSecurityUpdates !== undefined) {
		await client.request(
			`/repos/${ref.owner}/${ref.name}/automated-security-fixes`,
			input.dependabotSecurityUpdates ? "PUT" : "DELETE",
		);
	}
	const verification = await verifyRepositorySecurity({ repo: input.repo });
	const matches = Object.entries(requested).every(([key, value]) => value === undefined || verification.state[key as keyof RepositorySecurityState] === value);
	return { updated: true, verified: matches, dryRun: false, repo: input.repo, requested, state: verification.state };
}

export async function verifyRepositorySecurity(input: GitHubVerifySecurityControlsInput) {
	const ref = parseRepo(input.repo);
	const client = await getGitHubClient();
	const repo = await client.request(`/repos/${ref.owner}/${ref.name}`) as any;
	const [privateReporting, automatedFixes] = await Promise.all([
		readEnabledEndpoint(client, `/repos/${ref.owner}/${ref.name}/private-vulnerability-reporting`),
		readEnabledEndpoint(client, `/repos/${ref.owner}/${ref.name}/automated-security-fixes`),
	]);
	const analysis = repo.security_and_analysis ?? {};
	const state: RepositorySecurityState = {
		privateVulnerabilityReporting: privateReporting,
		secretScanning: enabled(analysis.secret_scanning),
		pushProtection: enabled(analysis.secret_scanning_push_protection),
		nonProviderPatterns: enabled(analysis.secret_scanning_non_provider_patterns),
		validityChecks: enabled(analysis.secret_scanning_validity_checks),
		dependabotSecurityUpdates: automatedFixes,
	};
	return { ok: Object.values(state).every(Boolean), repo: input.repo, state };
}

function normalizeRequested(input: GitHubSecurityControlsInput): Partial<RepositorySecurityState> {
	return {
		privateVulnerabilityReporting: input.privateVulnerabilityReporting,
		secretScanning: input.secretScanning,
		pushProtection: input.pushProtection,
		nonProviderPatterns: input.nonProviderPatterns,
		validityChecks: input.validityChecks,
		dependabotSecurityUpdates: input.dependabotSecurityUpdates,
	};
}

function enabled(value: any): boolean {
	return value?.status === "enabled";
}

async function readEnabledEndpoint(client: Awaited<ReturnType<typeof getGitHubClient>>, path: string): Promise<boolean> {
	try {
		const result = await client.request(path) as any;
		return result?.enabled !== false;
	} catch (error) {
		if (typeof error === "object" && error !== null && "status" in error && (error as { status?: number }).status === 404) return false;
		throw error;
	}
}
