# Product vision and success measures

## Vision

`pi-github-admin` is the safe, typed GitHub operations layer for Pi agents and their operators. It should make common repository administration predictable, reviewable, and verifiable without becoming a generic wrapper around every `gh` command.

## Users and outcomes

- **Pi operators** describe a repository outcome with typed inputs instead of assembling shell commands and JSON.
- **Maintainers** reuse idempotent, dry-run-capable operations with consistent safety checks.
- **Contributors** can extend a small REST-backed architecture and validate changes offline.

The product succeeds when an operator can inspect access, preview a mutation, apply it, and verify the resulting GitHub state with minimal ambiguity.

## Product principles

1. Preview before mutation: every mutation supports a meaningful `dryRun` when practical.
2. Verify outcomes: composite workflows expose structured verification, not optimistic success text.
3. Prefer safe defaults: destructive and merge operations stop when preconditions are unclear.
4. Keep credentials contained: diagnostics identify the auth source but never return secrets.
5. Compose focused tools: add small API-backed operations before higher-level workflows.

## Maintainer KPIs

Review these quarterly and record the snapshot in `docs/WORKLOG.md`.

| Measure | Target | Evidence |
| --- | --- | --- |
| Required checks | 100% of changes pass typecheck, tests with coverage, release metadata verification, and high-severity audit | CI run and local `npm run verify` |
| Offline mutation safety | 100% of new mutations have a no-network dry-run test | Test names and coverage report |
| Critical helper coverage | Coverage never falls below committed thresholds | `coverage/coverage-summary.json` |
| Operator recovery | Every documented auth/API failure class has a next action | `docs/OPERATIONS.md` review |
| Release integrity | Package, lockfile, changelog, and release tag agree | `npm run verify:release`; tag check during release |
| Performance | Core offline helper benchmark remains reproducible, with no unexplained >20% median regression | `npm run benchmark` output attached to performance-sensitive changes |
| Backlog health | Roadmap issues have an owner/intent, milestone, or explicit defer decision within 30 days | Quarterly backlog review |

These are maintainer signals, not promises of GitHub API latency or availability.
