# Changelog

## Unreleased

### Added
- `github_delete_branch` to safely delete branches with merged-only checks against the default or provided base branch.

## 0.4.0 - 2026-06-30

### Added
- `github_link_pr_issues` to add existing issue references to PR bodies with duplicate detection.
- `github_merge_pr_when_ready` to merge PRs only after clean/check-success criteria are satisfied.

## 0.3.0 - 2026-06-30

Expanded the package into GitHub conversation/comment operations and documented the next broader roadmap.

### Added
- `github_comment_issue`
- `github_comment_pr`
- `github_edit_comment`
- `github_delete_comment`
- shared API helpers for issue/PR conversation comments
- dry-run coverage for new comment operations
- roadmap issue creation for the next package phases

### Improved
- README examples now include comment lifecycle usage
- test coverage expanded for the new comment helpers

## 0.2.0 - 2026-06-30

Expanded release covering the initial roadmap issues.

### Added
- `github_create_repo`
- `github_ship_repo`
- dry-run support across mutating tools
- richer auth diagnostics with optional repo access inspection
- richer verification detail output

### Improved
- issue duplicate detection now uses normalized title/body matching
- release duplicate detection now uses tag or normalized title/body matching
- README updated to reflect the broader workflow surface

## 0.1.0 - 2026-06-30

Initial release.

### Added
- Pi-native GitHub admin package scaffold
- GitHub auth inspection via environment or `gh auth token`
- tools for repo metadata, branch protection, labels, milestones, issues, releases, and verification
- basic tests and CI for typecheck + test
