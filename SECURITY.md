# Security Policy

## Supported versions

Security fixes are applied to the latest release and to the `main` branch. The
project does not currently promise backports to older release lines.

## Reporting a vulnerability

Do not open a public issue containing a token, authorization header, private
repository data, or reproducible exploit details.

Use the repository's private **Report a vulnerability** flow:
<https://github.com/T50-Systems/pi-github-admin/security/advisories/new>. If the
flow is unexpectedly unavailable, do not open a public report; contact a T50
Systems repository administrator through an already trusted private channel and
include no secret material until that channel is confirmed.

A useful private report includes:

- affected version or commit;
- affected tool and operation;
- impact and required permissions;
- sanitized reproduction steps;
- whether a credential may have been exposed; and
- a suggested mitigation, if known.

Revoke or rotate an exposed credential immediately; do not wait for project
triage.


## Security alert ownership and targets

The repository maintainers own GitHub secret-scanning and dependency alerts. A
maintainer acknowledges a new high/critical secret or dependency alert within one
business day and other alerts within three business days. The owner then:

1. validates reachability and records a sanitized disposition;
2. marks false positives only with evidence and a reviewable reason;
3. immediately revokes/rotates any plausibly exposed credential and escalates to
   the owning organization administrator;
4. applies or tracks a safe dependency update, with a five-business-day status
   update for unresolved high/critical findings; and
5. verifies closure in GitHub without copying sensitive alert payloads into public
   issues or pull requests.

`github_configure_security` provides a dry-run-first automation surface for private
vulnerability reporting, secret scanning, push protection, non-provider patterns,
validity checks, and Dependabot security updates. `github_verify_security` reads
the resulting state. Applying those controls is a separate administrator action;
tests use a mocked HTTP boundary and never alter a repository.

## Credential model

The extension discovers credentials in this order:

1. `GITHUB_TOKEN`;
2. `GH_TOKEN`;
3. `gh auth token`.

Credentials are held in memory only long enough to authenticate GitHub API
requests. Tool results and diagnostics may identify the credential source and
GitHub login, but must never return the credential itself.

Operators should:

- use short-lived, least-privileged credentials;
- scope repository access to only the repositories being administered;
- keep tokens out of shell history, logs, screenshots, fixtures, and issue/PR
  text;
- use a dedicated disposable repository for live integration checks; and
- review a mutating tool with `dryRun: true` before applying it when supported.

## Contributor security requirements

Changes that add or modify GitHub operations must:

- preserve `dryRun` behavior for mutations without resolving auth or making
  network requests;
- avoid embedding credentials in URLs or error messages;
- use the shared authenticated request path so headers remain consistent;
- return sanitized, actionable GitHub errors;
- add tests for authorization-sensitive decisions and destructive safeguards;
  and
- document any newly required GitHub permission.

Never commit `.env` files, Pi auth files, GitHub CLI credential stores, personal
access tokens, or captured API payloads from private repositories.

## Dependency and release checks

Before merging dependency or release changes, run:

```bash
npm ci
npm run typecheck
npm test
npm audit
npm pack --dry-run
```

Treat audit findings according to exploitability in this package's runtime
context; do not apply an unreviewed forced upgrade that introduces breaking
changes. Inspect the dry-run package contents to ensure local files and secrets
are not included.
