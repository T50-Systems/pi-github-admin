import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { configureRepositorySecurity, verifyRepositorySecurity } from "../security.js";

export const SECURITY_TOOL_NAMES = ["github_configure_security", "github_verify_security"] as const;

export function registerSecurityTools(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "github_configure_security",
		label: "GitHub Configure Security",
		description: "Configure supported GitHub repository security controls declaratively and verify the resulting state.",
		parameters: Type.Object({
			repo: Type.String(),
			privateVulnerabilityReporting: Type.Optional(Type.Boolean()),
			secretScanning: Type.Optional(Type.Boolean()),
			pushProtection: Type.Optional(Type.Boolean()),
			nonProviderPatterns: Type.Optional(Type.Boolean()),
			validityChecks: Type.Optional(Type.Boolean()),
			dependabotSecurityUpdates: Type.Optional(Type.Boolean()),
			dryRun: Type.Optional(Type.Boolean()),
		}, { additionalProperties: false }),
		async execute(_id, params) {
			const result = await configureRepositorySecurity(params);
			const text = result.dryRun
				? `Dry run: would configure security for ${params.repo}`
				: result.verified
					? `Repository security configured for ${params.repo}`
					: `Repository security configuration could not be fully verified for ${params.repo}.${formatRecovery("recovery" in result ? result.recovery : undefined)}`;
			return {
				content: [{ type: "text", text }],
				details: result,
			};
		},
	});
	pi.registerTool({
		name: "github_verify_security",
		label: "GitHub Verify Security",
		description: "Read and verify supported GitHub repository security controls without mutation.",
		parameters: Type.Object({ repo: Type.String() }, { additionalProperties: false }),
		async execute(_id, params) {
			const result = await verifyRepositorySecurity(params);
			return {
				content: [{
					type: "text",
					text: result.ok
						? `Repository security verified for ${params.repo}`
						: `Repository security gaps found for ${params.repo}.${formatRecovery(result.recovery)}`,
				}],
				details: result,
			};
		},
	});
}

function formatRecovery(recovery: readonly string[] | undefined): string {
	if (!recovery?.length) return " Recovery: review the per-control result before changing repository settings.";
	return ` Recovery: ${recovery.join(" ")}`;
}
