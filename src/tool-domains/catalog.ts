import { SECURITY_TOOL_NAMES } from "./security.js";

export const TOOL_DOMAINS = {
	repositories: ["github_get_auth", "github_create_repo", "github_set_repo_metadata"],
	issues: ["github_create_labels", "github_create_milestone", "github_create_issue"],
	pullRequests: ["github_link_pr_issues", "github_merge_pr_when_ready", "github_list_prs", "github_get_pr_checks", "github_comment_issue", "github_comment_pr", "github_edit_comment", "github_delete_comment"],
	branches: ["github_protect_branch", "github_require_pr_for_main", "github_delete_branch"],
	releases: ["github_create_release"],
	verification: ["github_verify_repo_state", "github_ship_repo"],
	security: [...SECURITY_TOOL_NAMES],
} as const;

export const ALL_TOOL_NAMES = Object.values(TOOL_DOMAINS).flat();
