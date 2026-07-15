import { getGitHubClient, type GitHubClient } from "./http.js";
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

export type RepositorySecurityCapability = "available" | "unavailable" | "unknown";
export type RepositorySecurityControlStatus = "enabled" | "disabled" | "unavailable" | "forbidden" | "unknown";
export type RepositorySecurityControlReason = "reported" | "omitted" | "forbidden" | "not_found_or_masked" | "unexpected_response";

export interface RepositorySecurityControlResult {
	capability: RepositorySecurityCapability;
	enabled: boolean | null;
	status: RepositorySecurityControlStatus;
	reason: RepositorySecurityControlReason;
	httpStatus?: 403 | 404;
	recovery?: string;
}

export type RepositorySecurityControlResults = {
	[K in keyof RepositorySecurityState]: RepositorySecurityControlResult;
};

const DISABLED_RECOVERY = "Review repository policy, then enable this control in GitHub settings only if required.";
const UNAVAILABLE_RECOVERY = "Review the repository plan, organization policy, and caller visibility before attempting to enable this control.";
const FORBIDDEN_RECOVERY = "Verify the caller has the minimum required repository administration or security-manager permission, then retry the read.";
const MASKED_NOT_FOUND_RECOVERY = "Confirm the repository reference and caller access; GitHub may mask authorization failures as 404, so do not infer that the control is unsupported.";
const UNEXPECTED_RECOVERY = "Retry the read and compare GitHub's response with the documented security-control shape before changing the control.";

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
	const matches = Object.entries(requested).every(([key, value]) => {
		if (value === undefined) return true;
		const control = verification.controls[key as keyof RepositorySecurityState];
		return control.capability === "available" && control.enabled === value;
	});
	return {
		updated: true,
		verified: matches,
		dryRun: false,
		repo: input.repo,
		requested,
		state: verification.state,
		controls: verification.controls,
		recovery: verification.recovery,
	};
}

export async function verifyRepositorySecurity(input: GitHubVerifySecurityControlsInput) {
	const ref = parseRepo(input.repo);
	const client = await getGitHubClient();
	const basePath = `/repos/${ref.owner}/${ref.name}`;
	const [repositoryAnalysis, privateReporting, automatedFixes] = await Promise.all([
		readRepositoryAnalysis(client, basePath),
		readEnabledEndpoint(client, `${basePath}/private-vulnerability-reporting`),
		readEnabledEndpoint(client, `${basePath}/automated-security-fixes`),
	]);
	const controls: RepositorySecurityControlResults = {
		privateVulnerabilityReporting: privateReporting,
		secretScanning: readAnalysisControl(repositoryAnalysis, "secret_scanning"),
		pushProtection: readAnalysisControl(repositoryAnalysis, "secret_scanning_push_protection"),
		nonProviderPatterns: readAnalysisControl(repositoryAnalysis, "secret_scanning_non_provider_patterns"),
		validityChecks: readAnalysisControl(repositoryAnalysis, "secret_scanning_validity_checks"),
		dependabotSecurityUpdates: automatedFixes,
	};
	const state: RepositorySecurityState = {
		privateVulnerabilityReporting: legacyEnabled(controls.privateVulnerabilityReporting),
		secretScanning: legacyEnabled(controls.secretScanning),
		pushProtection: legacyEnabled(controls.pushProtection),
		nonProviderPatterns: legacyEnabled(controls.nonProviderPatterns),
		validityChecks: legacyEnabled(controls.validityChecks),
		dependabotSecurityUpdates: legacyEnabled(controls.dependabotSecurityUpdates),
	};
	const recovery = [...new Set(Object.values(controls).flatMap((control) => control.recovery ? [control.recovery] : []))];
	return { ok: Object.values(state).every(Boolean), repo: input.repo, state, controls, recovery };
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

type RepositoryAnalysisRead =
	| { kind: "reported"; analysis: Record<string, unknown> }
	| { kind: "failure"; result: RepositorySecurityControlResult };

async function readRepositoryAnalysis(client: GitHubClient, path: string): Promise<RepositoryAnalysisRead> {
	try {
		const repository = await client.request(path) as { security_and_analysis?: unknown };
		const analysis = isRecord(repository.security_and_analysis) ? repository.security_and_analysis : {};
		return { kind: "reported", analysis };
	} catch (error) {
		const result = expectedFailureResult(error);
		if (result) return { kind: "failure", result };
		throw error;
	}
}

function readAnalysisControl(source: RepositoryAnalysisRead, key: string): RepositorySecurityControlResult {
	if (source.kind === "failure") return { ...source.result };
	const value = source.analysis[key];
	if (value === undefined) {
		return {
			capability: "unavailable",
			enabled: null,
			status: "unavailable",
			reason: "omitted",
			recovery: UNAVAILABLE_RECOVERY,
		};
	}
	if (isRecord(value) && (value.status === "enabled" || value.status === "disabled")) {
		return reportedResult(value.status === "enabled");
	}
	return {
		capability: "unknown",
		enabled: null,
		status: "unknown",
		reason: "unexpected_response",
		recovery: UNEXPECTED_RECOVERY,
	};
}

async function readEnabledEndpoint(client: GitHubClient, path: string): Promise<RepositorySecurityControlResult> {
	try {
		const result = await client.request(path) as { enabled?: unknown } | undefined;
		// Preserve the legacy endpoint rule: any successful response is enabled unless it explicitly reports false.
		return reportedResult(result?.enabled !== false);
	} catch (error) {
		const result = expectedFailureResult(error);
		if (result) return result;
		throw error;
	}
}

function reportedResult(enabled: boolean): RepositorySecurityControlResult {
	return {
		capability: "available",
		enabled,
		status: enabled ? "enabled" : "disabled",
		reason: "reported",
		...(enabled ? {} : { recovery: DISABLED_RECOVERY }),
	};
}

function expectedFailureResult(error: unknown): RepositorySecurityControlResult | undefined {
	const status = errorStatus(error);
	if (status === 403) {
		return {
			capability: "unknown",
			enabled: null,
			status: "forbidden",
			reason: "forbidden",
			httpStatus: 403,
			recovery: FORBIDDEN_RECOVERY,
		};
	}
	if (status === 404) {
		return {
			capability: "unknown",
			enabled: null,
			status: "unknown",
			reason: "not_found_or_masked",
			httpStatus: 404,
			recovery: MASKED_NOT_FOUND_RECOVERY,
		};
	}
	return undefined;
}

function errorStatus(error: unknown): number | undefined {
	return typeof error === "object" && error !== null && "status" in error
		? (error as { status?: number }).status
		: undefined;
}

function legacyEnabled(result: RepositorySecurityControlResult): boolean {
	return result.enabled === true;
}

function isRecord(value: unknown): value is Record<string, any> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
