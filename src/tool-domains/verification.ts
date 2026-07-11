import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerSelectedToolDefinitions } from "../tool-registrations.js";

export const VERIFICATION_TOOL_NAMES = ["github_verify_repo_state", "github_ship_repo"] as const;
export const registerVerificationTools = (pi: ExtensionAPI): void => registerSelectedToolDefinitions(pi, VERIFICATION_TOOL_NAMES);
