# Backlog governance

## Intake and classification

Every issue should state the operator outcome, scope boundary, acceptance evidence, and safety implications. Apply one primary category (`roadmap`, `bug`, `security`, `maintenance`, or `documentation`) and add `help wanted` only when the task is independently actionable. Use `good first issue` only for bounded work with named files and a local validation path.

## Milestone policy

- **Now — operator trust:** safety, diagnostics, tests, release integrity, and regressions in current tools.
- **Next — workflow completeness:** missing issue/PR/branch lifecycle operations and reusable safety presets.
- **Later — policy at scale:** org/team administration, Projects v2, rulesets, bulk plan/apply, and policy packs.

Assign a milestone only when maintainers intend to schedule the work. Otherwise record an explicit defer reason. Review unowned roadmap items at least quarterly; close only when acceptance criteria are evidenced or the issue records why the scope is no longer desired.

## Current roadmap issue disposition

| Issue | Foundation disposition | Follow-up boundary |
| --- | --- | --- |
| #8 | Phased roadmap and scope boundaries documented | Individual missing surfaces remain separate follow-up work |
| #18 | Product vision, users, principles, and KPIs documented | Revisit KPI values quarterly |
| #19 | README quickstart and troubleshooting path refreshed | Validate against clean-machine feedback |
| #22 | High-risk offline dry-run and auth tests plus coverage thresholds added | Expand mocked API response/error cases with each tool change |
| #23 | CI standardized around typecheck, coverage, release verification, audit, and package inspection | Add multi-Node matrix only when another runtime is supported |
| #24 | Release/changelog procedure and metadata verifier added | Publication remains a deliberate maintainer action |
| #26 | Explicit stateless configuration and credential precedence documented | Add configuration only when a concrete runtime need exists |
| #27 | Error classification and recovery steps documented | Improve structured API error fields in a focused runtime change |
| #28 | Current health/trace model and observability boundaries documented | Add request IDs/telemetry only with a privacy-aware design |
| #29 | Reproducible offline benchmark and budgets added | Track baselines on performance-sensitive changes |
| #31 | Pi install, bootstrap, PR, and CI integration recipes added | Add tested recipes as new workflows land |
| #32 | Intake, milestones, defer/close rules, and issue dispositions documented | Apply labels/milestones separately after maintainer review |

## Issue #8 assessment

Issue #8 is complete as a **roadmap deliverable**, not as a claim that every GitHub API surface is implemented. Its acceptance criteria asked for explicit phases, clear scope boundaries, and a structure for decomposing future work; this document and [`ROADMAP.md`](ROADMAP.md) provide that.

The current surface covers bootstrap, comment mutation, selected PR operations, safe branch deletion, and branch protection. Missing issue/PR lifecycle, broader branch/repository settings, collaborators/teams, Projects v2, rulesets, policy packs, bulk sync, and plan/apply remain intentionally grouped under **Next** and **Later** for separate bounded issues.
