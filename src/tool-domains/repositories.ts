import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerSelectedToolDefinitions } from "../tool-registrations.js";

export const REPOSITORY_TOOL_NAMES = ["github_get_auth", "github_create_repo", "github_set_repo_metadata"] as const;
export const registerRepositoryTools = (pi: ExtensionAPI): void => registerSelectedToolDefinitions(pi, REPOSITORY_TOOL_NAMES);
