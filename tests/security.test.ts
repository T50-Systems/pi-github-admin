import { afterEach, describe, expect, it, vi } from "vitest";
import {
	configureRepositorySecurity,
	GitHubApiError,
	setGitHubClientFactoryForTests,
	type GitHubClient,
	verifyRepositorySecurity,
} from "../src/index.js";
import { registerGitHubAdminTools } from "../src/tools.js";
import enabledFixture from "./fixtures/security/enabled.json";
import disabledFixture from "./fixtures/security/disabled.json";
import omittedFixture from "./fixtures/security/omitted.json";
import forbiddenFixture from "./fixtures/security/forbidden-403.json";
import maskedNotFoundFixture from "./fixtures/security/masked-404.json";
import partialFixture from "./fixtures/security/partial.json";

type FixtureResponse = { status: number; body?: unknown; message?: string };
type SecurityFixture = {
	name: string;
	repository: FixtureResponse;
	privateVulnerabilityReporting: FixtureResponse;
	dependabotSecurityUpdates: FixtureResponse;
};

const controls = [
	"privateVulnerabilityReporting",
	"secretScanning",
	"pushProtection",
	"nonProviderPatterns",
	"validityChecks",
	"dependabotSecurityUpdates",
] as const;

function installFixture(fixture: SecurityFixture): GitHubClient {
	const client = {
		request: vi.fn(async (path: string, method = "GET") => {
			if (method !== "GET") return {};
			const response = path.endsWith("/private-vulnerability-reporting")
				? fixture.privateVulnerabilityReporting
				: path.endsWith("/automated-security-fixes")
					? fixture.dependabotSecurityUpdates
					: fixture.repository;
			if (response.status >= 400) {
				throw new GitHubApiError({
					message: response.message ?? "fixture diagnostic detail",
					method,
					path,
					status: response.status,
				});
			}
			return response.body ?? {};
		}),
		requestWithMeta: vi.fn(async () => { throw new Error("not used"); }),
	} as unknown as GitHubClient;
	setGitHubClientFactoryForTests(() => client);
	return client;
}

function collectTools() {
	const tools: any[] = [];
	registerGitHubAdminTools({ registerTool: (tool: any) => tools.push(tool) } as any);
	return new Map(tools.map((tool) => [tool.name, tool]));
}

afterEach(() => setGitHubClientFactoryForTests());

describe("repository security capability results", () => {
	it("reports enabled controls while preserving true legacy state and ok", async () => {
		installFixture(enabledFixture as SecurityFixture);
		const result = await verifyRepositorySecurity({ repo: "o/r" });

		expect(result.ok).toBe(true);
		expect(Object.values(result.state)).toEqual(Array(6).fill(true));
		for (const control of controls) {
			expect(result.controls[control]).toMatchObject({
				capability: "available",
				enabled: true,
				status: "enabled",
				reason: "reported",
			});
		}
		expect(result.recovery).toEqual([]);
	});

	it("distinguishes explicitly disabled controls from capability", async () => {
		installFixture(disabledFixture as SecurityFixture);
		const result = await verifyRepositorySecurity({ repo: "o/r" });

		expect(result.ok).toBe(false);
		expect(Object.values(result.state)).toEqual(Array(6).fill(false));
		for (const control of controls) {
			expect(result.controls[control]).toMatchObject({
				capability: "available",
				enabled: false,
				status: "disabled",
				reason: "reported",
			});
		}
		expect(result.recovery).toHaveLength(1);
	});

	it("reports omitted analysis controls as unavailable to the read", async () => {
		installFixture(omittedFixture as SecurityFixture);
		const result = await verifyRepositorySecurity({ repo: "o/r" });

		expect(result.state).toEqual({
			privateVulnerabilityReporting: true,
			secretScanning: false,
			pushProtection: false,
			nonProviderPatterns: false,
			validityChecks: false,
			dependabotSecurityUpdates: true,
		});
		for (const control of ["secretScanning", "pushProtection", "nonProviderPatterns", "validityChecks"] as const) {
			expect(result.controls[control]).toMatchObject({
				capability: "unavailable",
				enabled: null,
				status: "unavailable",
				reason: "omitted",
			});
		}
	});

	it("returns sanitized forbidden results instead of failing the whole read", async () => {
		installFixture(forbiddenFixture as SecurityFixture);
		const result = await verifyRepositorySecurity({ repo: "o/r" });

		expect(result.ok).toBe(false);
		for (const control of controls) {
			expect(result.controls[control]).toMatchObject({
				capability: "unknown",
				enabled: null,
				status: "forbidden",
				reason: "forbidden",
				httpStatus: 403,
			});
		}
		expect(JSON.stringify(result)).not.toContain("diagnostic detail");
	});

	it("treats 404 as masked or not found without claiming unsupported or disabled", async () => {
		installFixture(maskedNotFoundFixture as SecurityFixture);
		const result = await verifyRepositorySecurity({ repo: "o/r" });

		expect(result.ok).toBe(false);
		expect(Object.values(result.state)).toEqual(Array(6).fill(false));
		for (const control of controls) {
			expect(result.controls[control]).toMatchObject({
				capability: "unknown",
				enabled: null,
				status: "unknown",
				reason: "not_found_or_masked",
				httpStatus: 404,
			});
		}
		expect(JSON.stringify(result)).not.toContain("diagnostic detail");
	});

	it("keeps distinct per-control evidence in a partial response", async () => {
		installFixture(partialFixture as SecurityFixture);
		const result = await verifyRepositorySecurity({ repo: "o/r" });

		expect(result.ok).toBe(false);
		expect(Object.fromEntries(controls.map((control) => [control, result.controls[control].status]))).toEqual({
			privateVulnerabilityReporting: "forbidden",
			secretScanning: "enabled",
			pushProtection: "disabled",
			nonProviderPatterns: "unavailable",
			validityChecks: "enabled",
			dependabotSecurityUpdates: "disabled",
		});
		expect(result.recovery).toHaveLength(3);
	});

	it("preserves the legacy successful-endpoint default", async () => {
		const fixture = structuredClone(enabledFixture) as SecurityFixture;
		fixture.privateVulnerabilityReporting.body = {};
		fixture.dependabotSecurityUpdates.body = {};
		installFixture(fixture);

		const result = await verifyRepositorySecurity({ repo: "o/r" });
		expect(result.state.privateVulnerabilityReporting).toBe(true);
		expect(result.state.dependabotSecurityUpdates).toBe(true);
		expect(result.controls.privateVulnerabilityReporting.enabled).toBe(true);
	});

	it("does not claim a requested disabled state was verified from unknown capability", async () => {
		installFixture(maskedNotFoundFixture as SecurityFixture);
		const result = await configureRepositorySecurity({ repo: "o/r", secretScanning: false });
		if (result.dryRun) throw new Error("expected live verification result");

		expect(result.state!.secretScanning).toBe(false);
		expect(result.controls!.secretScanning).toMatchObject({ capability: "unknown", enabled: null });
		expect(result.verified).toBe(false);
	});

	it("emits bounded recovery text without raw API diagnostics", async () => {
		installFixture(forbiddenFixture as SecurityFixture);
		const tool = collectTools().get("github_verify_security");
		const result = await tool.execute("id", { repo: "o/r" });
		const text = result.content[0].text as string;

		expect(text).toContain("Recovery:");
		expect(text).toContain("minimum required");
		expect(text).not.toContain("diagnostic detail");
		expect(JSON.stringify(result.details)).not.toContain("diagnostic detail");
	});
});
