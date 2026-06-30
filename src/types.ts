export interface GitHubAuthInfo {
  authenticated: boolean;
  login?: string;
  scopes?: string[];
  source?: "env" | "gh";
  message?: string;
  suggestions?: string[];
  repoAccess?: {
    repo: string;
    exists: boolean;
    permissions?: {
      admin?: boolean;
      maintain?: boolean;
      push?: boolean;
      triage?: boolean;
      pull?: boolean;
    };
  };
}

export interface GitHubRepoRef {
  owner: string;
  name: string;
}

export interface GitHubCreateRepoInput {
  owner: string;
  name: string;
  description?: string;
  visibility?: "public" | "private";
  homepage?: string;
  initialize?: boolean;
  dryRun?: boolean;
}

export interface GitHubRepoMetadataInput {
  repo: string;
  description?: string;
  homepage?: string;
  topics?: string[];
  hasIssues?: boolean;
  hasWiki?: boolean;
  dryRun?: boolean;
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
  dryRun?: boolean;
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
  dryRun?: boolean;
}

export interface GitHubIssueInput {
  repo: string;
  title: string;
  body: string;
  labels?: string[];
  milestone?: string;
  matchTitleOnly?: boolean;
  dryRun?: boolean;
}

export interface GitHubIssueCommentInput {
  repo: string;
  issueNumber: number;
  body: string;
  dryRun?: boolean;
}

export interface GitHubPullRequestCommentInput {
  repo: string;
  pullNumber: number;
  body: string;
  dryRun?: boolean;
}

export interface GitHubEditCommentInput {
  repo: string;
  commentId: number;
  body: string;
  dryRun?: boolean;
}

export interface GitHubDeleteCommentInput {
  repo: string;
  commentId: number;
  dryRun?: boolean;
}

export interface GitHubReleaseInput {
  repo: string;
  tag: string;
  title: string;
  target?: string;
  notes: string;
  draft?: boolean;
  prerelease?: boolean;
  matchTitleOnly?: boolean;
  dryRun?: boolean;
}

export interface GitHubVerifyInput {
  repo: string;
  checks: Array<"metadata" | "branch_protection" | "labels" | "milestones" | "issues" | "releases">;
  branch?: string;
  releaseTag?: string;
}

export interface GitHubShipRepoInput {
  repo: GitHubCreateRepoInput;
  metadata?: Omit<GitHubRepoMetadataInput, "repo">;
  labels?: GitHubLabelInput[];
  milestones?: Array<Omit<GitHubMilestoneInput, "repo">>;
  issues?: Array<Omit<GitHubIssueInput, "repo">>;
  branchProtection?: Omit<GitHubBranchProtectionInput, "repo">;
  release?: Omit<GitHubReleaseInput, "repo">;
  verify?: Omit<GitHubVerifyInput, "repo">;
  dryRun?: boolean;
}
