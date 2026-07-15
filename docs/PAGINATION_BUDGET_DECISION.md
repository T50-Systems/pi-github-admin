# Pagination regression budget decision

## Decision

The hosted pagination job is a required CI gate. After measuring the deterministic 100-page/10,000-item fake, CI rejects any run whose machine-readable result exceeds one of these bounds:

| Metric | Required limit |
| --- | ---: |
| p99 latency | 12 ms |
| Peak RSS | 134,217,728 bytes (128 MiB) |
| Peak heap used | 33,554,432 bytes (32 MiB) |

The policy lives in `scripts/pagination-budget.json`; `scripts/enforce-pagination-budget.mjs` validates the workload/fixture contract before applying all three limits.

## Hosted evidence

Three fresh GitHub-hosted executions used the merged workflow at commit `6aef64df0f8f5223334b50f3614f77d58247aed1`, `ubuntu-latest`, and Node `v22.23.1`. They are independent attempts of [CI run 29459726382](https://github.com/T50-Systems/pi-github-admin/actions/runs/29459726382), each on a fresh hosted job.

| Run attempt | p50 ms | p95 ms | p99 ms | Peak RSS bytes | Peak heap bytes |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 3.863 | 4.818 | 5.819 | 90,746,880 | 22,546,576 |
| 2 | 2.937 | 4.052 | 5.165 | 90,787,840 | 22,545,512 |
| 3 | 2.975 | 3.894 | 4.999 | 88,993,792 | 22,544,248 |
| **Observed maximum** | — | — | **5.819** | **90,787,840** | **22,546,576** |

All attempts completed three warmups and 25 samples, passed all four guard fixtures, and declared `liveGitHubApi: false`.

## Headroom rationale

- The 12 ms p99 bound is 106.2% above the observed 5.819 ms maximum. Tail latency from 25 samples is the noisiest signal on a shared runner, so a roughly 2x rounded bound avoids flaky failures while still detecting a material regression.
- The 128 MiB RSS bound is 47.8% above the observed 90,787,840-byte maximum.
- The 32 MiB heap bound is 48.8% above the observed 22,546,576-byte maximum.

The memory limits use recognizable binary boundaries and leave similar headroom. They remain bounded enough to catch sustained allocation growth rather than normal hosted-runner noise.

## Failure and rebaseline policy

A failing gate is a regression until investigated. Confirm the workload and fixtures are unchanged, reproduce locally, and inspect the uploaded JSON artifact. Do not raise a limit solely to make one run pass.

Rebaseline only after an intentional pagination/runtime change or a demonstrated hosted-runner shift. Collect at least three fresh successful hosted runs under the same workload, document every observed value and new headroom calculation in a reviewed PR, then update the policy. The benchmark must remain offline and the budget job must remain required.
