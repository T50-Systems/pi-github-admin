import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerSelectedToolDefinitions } from "../tool-registrations.js";

export const BRANCH_TOOL_NAMES = ["github_protect_branch", "github_require_pr_for_main", "github_delete_branch"] as const;
export const registerBranchTools = (pi: ExtensionAPI): void => registerSelectedToolDefinitions(pi, BRANCH_TOOL_NAMES);
