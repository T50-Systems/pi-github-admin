# Changelog

## Unreleased

### Added

- Product vision, success metrics, operational recovery, integration, performance,
  release, and backlog-governance guides.
- Coverage thresholds, offline dry-run regression tests, authentication tests, and
  a reproducible helper benchmark.
- Release metadata verification and standardized CI validation.

### Changed

- Repository parsing now rejects malformed references with extra path segments or
  surrounding whitespace.
- Repository, milestone, issue, release, and composite dry runs no longer resolve
  credentials or make GitHub requests.
- The README now provides a verification-first quickstart.

## 0.6.0 - 2026-07-01

### Added in 0.6.0

- `github_list_prs` to list pull requests similarly to `gh pr list --repo ...`.
- `github_require_pr_for_main` shortcut for PR-only `main` protection without
  required reviews.

## 0.5.0 - 2026-06-30

### Added in 0.5.0

- `github_delete_branch` to safely delete branches with merged-only checks
  against the default or provided base branch.
- `github_get_pr_checks` to inspect PR check-run/status state similarly to
  `gh pr checks`.

## 0.4.0 - 2026-06-30

### Added in 0.4.0

- `github_link_pr_issues` to add existing issue references to PR bodies with
  duplicate detection.
- `github_merge_pr_when_ready` to merge PRs only after clean/check-success
  criteria are satisfied.

## 0.3.0 - 2026-06-30

Expanded the package into GitHub conversation/comment operations and documented
the next broader roadmap.

### Added in 0.3.0

- `github_comment_issue`
- `github_comment_pr`
- `github_edit_comment`
- `github_delete_comment`
- shared API helpers for issue/PR conversation comments
- dry-run coverage for new comment operations
- roadmap issue creation for the next package phases

### Improved in 0.3.0

- README examples now include comment lifecycle usage
- test coverage expanded for the new comment helpers

## 0.2.0 - 2026-06-30

Expanded release covering the initial roadmap issues.

### Added in 0.2.0

- `github_create_repo`
- `github_ship_repo`
- dry-run support across mutating tools
- richer auth diagnostics with optional repo access inspection
- richer verification detail output

### Improved in 0.2.0

- issue duplicate detection now uses normalized title/body matching
- release duplicate detection now uses tag or normalized title/body matching
- README updated to reflect the broader workflow surface

## 0.1.0 - 2026-06-30

Initial release.

### Added in 0.1.0

- Pi-native GitHub admin package scaffold
- GitHub auth inspection via environment or `gh auth token`
- tools for repo metadata, branch protection, labels, milestones, issues,
  releases, and verification
- basic tests and CI for typecheck + test
