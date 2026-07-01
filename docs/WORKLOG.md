# Worklog

## 2026-06-30

### Branch cleanup tool
- added `github_delete_branch` so Pi can explicitly clean up/delete branches without relying on ad-hoc shell or repo-specific scripts
- made the delete flow safer by defaulting to merged-only checks against the default branch unless overridden
- added `github_get_pr_checks` so Pi can inspect a PR like `gh pr checks <number> --repo <owner/name>`
- added `github_list_prs` so Pi can inspect open/closed PR lists like `gh pr list --repo <owner/name>`
- added unit coverage for branch comparison safety classification
- updated README and changelog to document the new branch cleanup capability

## 2026-06-30

### Created `pi-github-admin`
- established a Pi-native GitHub admin package focused on the smallest high-value repo operations
- chose direct GitHub REST API calls instead of building on top of ad-hoc `gh` shell flows
- kept the first version intentionally minimal and tool-first

### Initial implementation
- added tools for:
  - auth inspection
  - repo metadata
  - branch protection
  - labels
  - milestones
  - issues
  - releases
  - verification
- added local tests and package scaffolding
- verified with:
  - `npm run typecheck`
  - `npm test`

### Release hardening
- created the GitHub repo under `T50-Systems`
- added CI
- protected `main`
- created roadmap issues and milestone
- published `v0.1.0`

### Roadmap issue implementation
- implemented `github_create_repo`
- implemented composite `github_ship_repo`
- added dry-run support across mutating tools
- improved duplicate detection for issues and releases
- improved auth diagnostics with optional repo access inspection
- expanded verification output with richer details
- merged the work through PR #6
- published `v0.2.0`

### Global Pi installation
- installed the package globally from GitHub tag:
  - `git:github.com/T50-Systems/pi-github-admin@v0.2.0`
- removed the previous local-path global install so Pi now resolves the package from the pinned release tag

### Comment operations and roadmap refresh
- added comment lifecycle support for GitHub conversations:
  - `github_comment_issue`
  - `github_comment_pr`
  - `github_edit_comment`
  - `github_delete_comment`
- added tests for dry-run coverage of the new comment helpers
- updated README examples for comment usage
- created a broader roadmap issue for future phases:
  - `#8 Roadmap: complete pi-github-admin beyond initial repo bootstrap scope`
- verified with:
  - `npm run typecheck`
  - `npm test`

### PR discipline helpers
- added `github_link_pr_issues` so agents can attach existing issues to a PR body before merge instead of creating duplicate issues
- added `github_merge_pr_when_ready` so merges enforce clean/check-success criteria before applying the merge
- documented the CasasRD #720-style workflow: link existing issue, verify checks, squash merge, optionally delete branch
