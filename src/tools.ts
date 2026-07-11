import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerRepositoryTools } from "./tool-domains/repositories.js";
import { registerIssueTools } from "./tool-domains/issues.js";
import { registerPullRequestTools } from "./tool-domains/pull-requests.js";
import { registerBranchTools } from "./tool-domains/branches.js";
import { registerReleaseTools } from "./tool-domains/releases.js";
import { registerVerificationTools } from "./tool-domains/verification.js";
import { registerSecurityTools } from "./tool-domains/security.js";

export { TOOL_DOMAINS, ALL_TOOL_NAMES } from "./tool-domains/catalog.js";

export function registerGitHubAdminTools(pi: ExtensionAPI): void {
	registerRepositoryTools(pi);
	registerIssueTools(pi);
	registerPullRequestTools(pi);
	registerBranchTools(pi);
	registerReleaseTools(pi);
	registerVerificationTools(pi);
	registerSecurityTools(pi);
}
