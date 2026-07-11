# Security Policy

## Supported versions

Security fixes are applied to the latest release and to the `main` branch. The
project does not currently promise backports to older release lines.

## Reporting a vulnerability

Do not open a public issue containing a token, authorization header, private
repository data, or reproducible exploit details.

Use GitHub's **Report a vulnerability** flow on the repository Security page
when private vulnerability reporting is available. If that option is not
available, open a public issue with only a sanitized summary and ask the
maintainers to establish a private contact channel. Include no secrets or
sensitive reproduction data in that issue.

A useful private report includes:

- affected version or commit;
- affected tool and operation;
- impact and required permissions;
- sanitized reproduction steps;
- whether a credential may have been exposed; and
- a suggested mitigation, if known.

Revoke or rotate an exposed credential immediately; do not wait for project
triage.

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
