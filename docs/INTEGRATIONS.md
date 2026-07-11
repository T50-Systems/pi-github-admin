# Examples and integration recipes

## Install in Pi

From a local checkout:

```bash
npm ci
npm run verify
pi install /absolute/path/to/pi-github-admin
```

Restart Pi if the extension was installed while a session was running. Confirm registration by locating `github_get_auth` in the available tools.

## Authenticate and inspect

For interactive use, run `gh auth login`; for CI, provide a least-privileged `GITHUB_TOKEN`. Then call:

```json
github_get_auth({ "repo": "T50-Systems/pi-github-admin" })
```

Do not continue to mutation until repository permissions are understood.

## Preview a repository foundation

`github_ship_repo` composes metadata, labels, milestones, issues, protection, release, and verification. Start offline:

```json
github_ship_repo({
  "repo": { "owner": "example-org", "name": "example-service", "visibility": "private", "dryRun": true },
  "metadata": { "description": "Example service", "topics": ["example"] },
  "labels": [{ "name": "roadmap", "color": "5319e7", "description": "Planned work" }],
  "milestones": [{ "title": "Foundation", "description": "Initial delivery" }],
  "issues": [{ "title": "Document operations", "body": "Add runbook.", "labels": ["roadmap"], "milestone": "Foundation" }],
  "branchProtection": { "branch": "main", "requirePullRequest": true, "requiredApprovals": 0 },
  "verify": { "checks": ["metadata", "labels", "milestones", "issues", "branch_protection"], "branch": "main" },
  "dryRun": true
})
```

Review the plan, remove `dryRun` only with explicit approval, and verify actual state afterward.

## PR discipline recipe

1. Read the PR and select an existing issue when applicable.
2. Add traceability with `github_link_pr_issues` using `refs` unless merge should close the issue.
3. Inspect `github_get_pr_checks`.
4. Merge with `github_merge_pr_when_ready` only after checks and mergeability are acceptable.
5. Delete a branch separately with `github_delete_branch` when a reviewed cleanup is needed.

## CI integration

Automated tests should use dry runs and mocks, not live repositories. A manual integration smoke test must use a disposable repository and a short-lived token. Recommended preflight:

```bash
npm ci
npm run verify
npm audit --audit-level=high
npm pack --dry-run
```

See `docs/OPERATIONS.md` for recovery and `SECURITY.md` for credential handling.
