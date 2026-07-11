# Roadmap

The package remains a focused, API-backed GitHub administration layer for Pi.
Prioritization follows operator safety and workflow completeness, not API breadth
for its own sake. See `BACKLOG.md` for intake and milestone governance.

## Now — operator trust

- Maintain offline dry-run guarantees and focused coverage for destructive paths.
- Improve structured error classification and expose sanitized GitHub request IDs.
- Keep release metadata, changelog, package contents, and dependency checks reproducible.
- Validate quickstart and recovery guidance through clean-environment feedback.

## Next — workflow completeness

- Complete issue lifecycle: update, close/reopen, assign, and comment list/upsert.
- Complete PR lifecycle: create/update, reviewers/reviews, close/reopen, and status.
- Add branch create/existence/default/compare helpers and reviewed protection presets.
- Expand repository settings with explicit diagnostics and safe defaults.

## Later — policy at scale

- Collaborator, team, and organization-permission operations.
- Projects v2 and rulesets where the API surface is stable.
- Bulk synchronization, reusable repository archetypes, and a plan/apply model.
- Declarative policy packs with machine-readable remediation.

## Scope checkpoint: issue #8

Issue #8 remains open. Current tools cover bootstrap, comment mutation, selected PR
operations, safe branch deletion, and branch protection, but do not satisfy the
full communication, lifecycle, organization, project, governance, and bulk-workflow
scope described there. Closure requires a section-by-section inventory with evidence;
the maintainer-foundation work documented here is not sufficient by itself.
