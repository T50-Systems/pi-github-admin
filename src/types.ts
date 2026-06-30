export interface GitHubAuthInfo {
  authenticated: boolean;
  login?: string;
  scopes?: string[];
  source?: "env" | "gh";
}

export interface GitHubRepoRef {
  owner: string;
  name: string;
}

export interface GitHubRepoMetadataInput {
  repo: string;
  description?: string;
  homepage?: string;
  topics?: string[];
  hasIssues?: boolean;
  hasWiki?: boolean;
}

export interface GitHubBranchProtectionInput {
  repo: string;
  branch: string;
  requiredChecks?: string[];
  requirePullRequest?: boolean;
  requiredApprovals?: number;
  requireConversationResolution?: boolean;
  allowForcePushes?: boolean;
  allowDeletions?: boolean;
  applyToAdmins?: boolean;
}

export interface GitHubLabelInput {
  name: string;
  color: string;
  description?: string;
}

export interface GitHubMilestoneInput {
  repo: string;
  title: string;
  description?: string;
}

export interface GitHubIssueInput {
  repo: string;
  title: string;
  body: string;
  labels?: string[];
  milestone?: string;
}

export interface GitHubReleaseInput {
  repo: string;
  tag: string;
  title: string;
  target?: string;
  notes: string;
  draft?: boolean;
  prerelease?: boolean;
}

export interface GitHubVerifyInput {
  repo: string;
  checks: Array<"metadata" | "branch_protection" | "labels" | "milestones" | "issues" | "releases">;
  branch?: string;
  releaseTag?: string;
}
