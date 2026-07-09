# pi-github-admin

Pi-native GitHub administration tools for repository setup, branch protection, issues, labels, milestones, releases, PR discipline, and verification.

The package wraps high-value GitHub API operations in Pi tools with declarative inputs, dry-run support where practical, idempotent behavior, and consistent diagnostics. It reduces the need for ad-hoc `gh api` shell commands when an agent is managing repositories.

## Tool coverage

- Authentication and repository access diagnostics.
- Repository creation and metadata updates.
- Branch protection presets and declarative protection updates.
- Label, milestone, issue, and release creation.
- End-to-end repository bootstrap with verification.
- Issue and release duplicate detection.
- Pull request issue linking before merge.
- Merge-readiness checks and safe PR merging.
- PR check-run/status inspection.
- PR listing.
- Safe branch deletion/cleanup.
- Issue and PR comment create/edit/delete helpers.

## Tools

```text
github_get_auth
github_create_repo
github_set_repo_metadata
github_protect_branch
github_require_pr_for_main
github_create_labels
github_create_milestone
github_create_issue
github_comment_issue
github_comment_pr
github_edit_comment
github_delete_comment
github_delete_branch
github_create_release
github_link_pr_issues
github_merge_pr_when_ready
github_get_pr_checks
github_list_prs
github_verify_repo_state
github_ship_repo
```

## Why this package exists

Raw `gh`, hand-written JSON, and one-off shell scripts are powerful but brittle in agent workflows. `pi-github-admin` provides:

- structured schemas for each operation;
- predictable error messages;
- safer defaults for mutating calls;
- duplicate detection for issues/releases;
- verification tools that summarize final state;
- a single `github_ship_repo` path for bootstrapping common repo infrastructure.

## Authentication

Auth is resolved in this order:

1. `GITHUB_TOKEN`
2. `GH_TOKEN`
3. `gh auth token`

Use `github_get_auth` to inspect the active identity, token scopes, and optional repository access.

## Install

```bash
pi install git:github.com/T50-Systems/pi-github-admin
```

For local development:

```bash
git clone https://github.com/T50-Systems/pi-github-admin
cd pi-github-admin
pi install .
```

## Common workflows

### Bootstrap a repository

```json
github_ship_repo({
  "repo": {
    "owner": "T50-Systems",
    "name": "new-project",
    "description": "Project description",
    "visibility": "private",
    "initialize": true
  },
  "metadata": {
    "topics": ["pi", "automation"],
    "hasIssues": true,
    "hasWiki": false
  },
  "branchProtection": {
    "branch": "main",
    "requirePullRequest": true,
    "requiredApprovals": 0,
    "requireConversationResolution": true
  },
  "verify": {
    "checks": ["metadata", "branch_protection", "issues", "labels"]
  }
})
```

### Link issues before merging a PR

```json
github_link_pr_issues({
  "repo": "T50-Systems/example",
  "pullNumber": 42,
  "issueNumbers": [10],
  "keyword": "refs",
  "requireExistingIssues": true
})
```

### Merge only when ready

```json
github_merge_pr_when_ready({
  "repo": "T50-Systems/example",
  "pullNumber": 42,
  "method": "squash",
  "deleteBranch": true,
  "requireClean": true,
  "requireChecksSuccess": true
})
```

### Inspect checks and clean branches

```json
github_get_pr_checks({
  "repo": "T50-Systems/pi-github-admin",
  "pullNumber": 16
})
```

```json
github_delete_branch({
  "repo": "T50-Systems/pi-github-admin",
  "branch": "chore/cleanup-stale-branch",
  "requireMerged": true
})
```

## Repository layout

```text
extensions/index.ts   Pi extension/tool registration
src/api.ts            GitHub REST/gh helpers
src/auth.ts           token and auth diagnostics
src/tools.ts          tool schemas and handlers
src/types.ts          shared types
tests/                Vitest tests
docs/                 roadmap and worklog
```

## Development

```bash
npm install
npm run typecheck
npm test
```

## Current direction

See [`docs/ROADMAP.md`](docs/ROADMAP.md) and [`docs/WORKLOG.md`](docs/WORKLOG.md) for follow-up ideas such as richer protection presets, organization-level permission diagnostics, dry-run diffs, and GitHub Projects support.

## License

MIT
