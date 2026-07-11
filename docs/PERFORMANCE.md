# Performance baseline

## Scope

GitHub network latency dominates live operations and is not a stable local benchmark. The committed benchmark measures the offline decision helpers used for validation, matching, and dry-run planning. It uses deterministic in-memory fixtures and no credentials or network calls.

## Run

```bash
npm ci
npm run benchmark
```

Record Node version, operating system, CPU, commit, and Vitest output when comparing results. Run at least twice on an otherwise idle machine and compare medians rather than a single fastest sample.

## Initial budgets

| Scenario | Budget on a maintainer laptop | Rationale |
| --- | --- | --- |
| Parse and normalize helpers | Median below 0.05 ms/op | Constant-size local input |
| Match an issue in a 100-item page | Median below 0.25 ms/op | One GitHub page, linear scan |
| Deduplicate/append a few issue links | Median below 0.25 ms/op | Typical PR body and link set |

Treat an unexplained median regression above 20% as a review signal. The budgets are generous guardrails, not CI gates: shared runners are noisy. Optimize only after a reproducible regression, and preserve readability and safety over micro-optimizations.

For live workflows, record API call count and end-to-end duration separately. Do not benchmark mutations against production repositories.
