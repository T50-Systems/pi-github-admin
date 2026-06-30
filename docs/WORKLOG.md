# Worklog

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
