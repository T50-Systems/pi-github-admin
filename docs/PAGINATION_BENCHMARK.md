# Guarded pagination benchmark

## Purpose

The pagination benchmark measures the existing bounded collection path with a deterministic, in-memory `GitHubClient` fake. It performs no network requests and never calls the live GitHub API. The maximum workload is 100 pages and 10,000 items, matching the exported hard collection guards.

Run it locally with:

```bash
npm run benchmark:pagination
```

The command performs three warmup runs and 25 measured runs. It writes machine-readable JSON to `artifacts/pagination-benchmark.json` (override with `PAGINATION_BENCHMARK_OUTPUT`) and reports p50, p95, and p99 latency plus the peak observed RSS and heap usage. Guard fixtures cover maximum-item truncation, maximum-page truncation, repeated links, and an exact-boundary non-truncated result.

## Measurement versus decision

This change establishes evidence collection only. The hosted `pagination-baseline` job is deliberately nonblocking and uploads `pagination-benchmark-results` for comparison across GitHub-hosted runs. It does not encode a latency or memory budget.

After enough comparable hosted samples exist, maintainers should review run-to-run variance and open a separate budget PR if stable bounds can be justified. That decision PR should document the selected statistic, tolerated variance, runner assumptions, and failure/rebaseline process before turning a threshold into a required CI gate. A single local or hosted sample is not sufficient evidence for a hard budget.
