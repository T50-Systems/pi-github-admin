# Configuration, diagnostics, and recovery

## Configuration model

The extension has no configuration file and persists no state. Inputs are explicit per tool call. Runtime configuration is limited to authentication:

| Priority | Source | Recommended use |
| --- | --- | --- |
| 1 | `GITHUB_TOKEN` | CI or a deliberately scoped local session |
| 2 | `GH_TOKEN` | Compatibility with GitHub CLI-oriented environments |
| 3 | `gh auth token` | Interactive local use after `gh auth login` |

Use one source at a time so credential selection is obvious. Never commit `.env` files or token output. GitHub API version and headers are owned by the shared request layer and are not user-overridable.


Internal requests time out after 10 seconds by default. The implementation clamps configured test/runtime overrides to 1-120,000 ms. GET/HEAD requests retry at most twice for transient network failures, HTTP 429, rate-limit exhaustion, and selected 502/503/504 responses using bounded exponential backoff and jitter. POST, PATCH, PUT, and DELETE are never automatically retried, so a mutation cannot be duplicated by the transport policy.

## First diagnostics

1. Run `github_get_auth` with the target `owner/repo` when one exists.
2. Confirm `authenticated`, credential `source`, scopes, and repository permissions.
3. Preview the intended mutation with `dryRun: true`.
4. Apply the smallest operation.
5. Use `github_verify_repo_state` or the relevant read tool to verify the result.

The package intentionally emits structured results rather than application logs or metrics. Pi's tool-call transcript is the operation trace; sanitize it before sharing because repository names and issue content may still be sensitive.

## Failure and recovery table

| Symptom | Likely cause | Safe recovery |
| --- | --- | --- |
| No GitHub auth available | No environment token and `gh` is unavailable or logged out | Set a least-privileged token or run `gh auth login`, then retry `github_get_auth` |
| `401` | Expired, revoked, or invalid credential | Rotate/re-authenticate; do not paste the token into logs |
| `403` | Missing permission, org policy, branch rule, or rate limit | Inspect auth/repo permissions and GitHub response; request only the required permission |
| `404` for a known private repo | Wrong `owner/name` or token cannot see it | Check spelling and repository access; GitHub may mask authorization failures as 404 |
| `409`/`422` | State conflict or validation failure | Re-read current state, correct inputs, and repeat a dry run rather than forcing the change |
| Merge helper reports pending/failed checks | PR preconditions are not satisfied | Inspect `github_get_pr_checks`; fix or wait for checks, then retry |
| Branch deletion is refused | Default/base branch or unique commits detected | Choose the correct branch/base; merge or preserve unique commits before retrying |
| Partial composite workflow | Earlier API calls succeeded before a later call failed | Run `github_verify_repo_state`, compare actual state, then rerun idempotent steps individually |
| Request timed out | GitHub did not answer within the bounded timeout | Verify GitHub Status and network access, then repeat a read or run a fresh dry run before retrying a mutation |
| Rate limit exhausted | Structured error has `rateLimit.remaining: 0` | Wait until `rateLimit.resetAt` or the bounded `retryAfterSeconds` signal; do not rotate credentials merely to evade policy |
| Pagination reports `truncated` | Maximum pages/items or a repeated Link target stopped traversal | Narrow the query or inspect the truncation reason; correctness-sensitive mutations refuse to treat truncated verification as complete |
| Security control is `disabled` | GitHub explicitly reported an available control as off | Review repository policy, then use `github_configure_security` only if the control is required |
| Security control is `unavailable` | The repository response omitted the control | Review plan, organization policy, and caller visibility; omission is not proof about every plan or policy |
| Security control is `forbidden` | GitHub returned 403 for that read | Grant only the minimum repository administration or security-manager permission needed, then retry |
| Security control is `unknown` after 404 | Repository/control was not found or GitHub masked an authorization failure | Confirm `owner/name` and caller access; do not infer unsupported or disabled state from 404 |

## Debugging and observability boundaries

- Record tool name, sanitized input, start/end time, result status, and GitHub request ID when Pi exposes it.
- Never record tokens, authorization headers, private response bodies, or unsanitized errors.
- Use `dryRun` output as the planned-change record and verification output as the actual-state record.
- GitHub API latency, rate limits, and service health are external. Check GitHub Status before changing code in response to transient failures.
- There is no background worker or health endpoint. A successful `github_get_auth` plus a read-only repository operation is the current health check.


`GitHubApiError` exposes `status`, `requestId`, `documentationUrl`, `rateLimit` (`limit`, `remaining`, `resetAt`, `retryAfterSeconds`), `retryable`, `method`, and a sanitized `path`. Response text is reduced to GitHub's message/documentation fields, authorization-shaped values are redacted, and surfaced text is capped. The package never logs errors automatically; callers decide where sanitized structured details may be recorded.

Security verification exposes only closed reason/status values, numeric 403/404 status,
and static recovery text for expected capability failures. It does not copy raw GitHub
failure messages into the result. See [the capability-result decision](SECURITY_CAPABILITY_RESULTS.md).

Escalate repeated or ambiguous failures with the tool name, sanitized status/message, target resource type, and exact recovery steps already attempted.
