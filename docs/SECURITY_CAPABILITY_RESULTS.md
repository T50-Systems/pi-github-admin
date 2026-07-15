# Security-control capability results

## Decision

Security verification reports a per-control result in `controls` while retaining the
legacy `state` booleans and top-level `ok`. The additive result separates whether a
control is observable from whether it is enabled:

| `status` | `capability` | `enabled` | Meaning |
| --- | --- | --- | --- |
| `enabled` | `available` | `true` | GitHub reported the control enabled. |
| `disabled` | `available` | `false` | GitHub reported the control disabled. |
| `unavailable` | `unavailable` | `null` | The repository response omitted this control; it is unavailable to this read, not proven absent from every plan or policy. |
| `forbidden` | `unknown` | `null` | GitHub returned 403, so the caller cannot determine capability or state. |
| `unknown` | `unknown` | `null` | GitHub returned a masked/not-found 404 or an unexpected response shape. |

Each result also has a closed `reason` value. Expected 403/404 failures expose only a
numeric `httpStatus` and a static recovery action; raw GitHub response messages are not
copied into verification output.

## Conservative 404 treatment

GitHub can mask authorization failures as 404. Therefore `not_found_or_masked` never
means "unsupported" or "disabled" in the additive result. Confirm the repository
reference and caller access before drawing a plan, policy, or feature-availability
conclusion. Live read-only evidence must use the same qualification.

## Legacy compatibility

`state` remains the six-boolean object returned to existing callers. `ok` remains the
logical AND of those booleans; it is not redefined around the new taxonomy. Existing
successful endpoint responses remain enabled unless they explicitly contain
`enabled: false`, omitted analysis fields remain `false`, and endpoint 404s remain
`false`. A handled 403 has no earlier successful-result equivalent and is represented
conservatively as `false` in `state` while `controls` records `forbidden`/`unknown`.

New callers should use `controls` for diagnostics and use `state`/`ok` only when they
need the compatibility contract.

## Recovery

Recovery text is deliberately bounded and static:

1. For `disabled`, review repository policy and enable the control only if required.
2. For `unavailable`, review repository plan, organization policy, and caller visibility.
3. For `forbidden`, grant only the minimum repository administration or
   security-manager permission needed for the read, then retry.
4. For `not_found_or_masked`, confirm `owner/name` and caller access without assuming
   the feature is unsupported.

Verification is read-only. Use `github_configure_security` separately and deliberately
when a policy-approved state change is required.
