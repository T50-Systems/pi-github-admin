import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerSelectedToolDefinitions } from "../tool-registrations.js";

export const ISSUE_TOOL_NAMES = ["github_create_labels", "github_create_milestone", "github_create_issue"] as const;
export const registerIssueTools = (pi: ExtensionAPI): void => registerSelectedToolDefinitions(pi, ISSUE_TOOL_NAMES);
