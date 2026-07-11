import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerSelectedToolDefinitions } from "../tool-registrations.js";

export const PULL_REQUEST_TOOL_NAMES = ["github_link_pr_issues", "github_merge_pr_when_ready", "github_list_prs", "github_get_pr_checks", "github_comment_issue", "github_comment_pr", "github_edit_comment", "github_delete_comment"] as const;
export const registerPullRequestTools = (pi: ExtensionAPI): void => registerSelectedToolDefinitions(pi, PULL_REQUEST_TOOL_NAMES);
