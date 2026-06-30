# Changelog

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
