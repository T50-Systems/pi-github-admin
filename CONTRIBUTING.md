# Contributing

## Prerequisites

- Node.js 22 or newer
- npm (the version bundled with your Node.js installation is sufficient)
- Git
- GitHub CLI (`gh`) only for manual authentication or repository checks

The automated test suite does not require GitHub credentials and must not
mutate live repositories.

## Clone to verified change

```bash
git clone https://github.com/T50-Systems/pi-github-admin.git
cd pi-github-admin
npm ci
npm run typecheck
npm test
```

Use `npm ci`, rather than `npm install`, when verifying a clean checkout so the
committed lockfile is honored exactly.

## Development workflow

1. Create a focused branch from current `main`. Existing branches use prefixes
   such as `docs/`, `feat/`, and `release/`; choose the prefix that matches the
   change.
2. Keep a pull request limited to one coherent concern and reference the
   applicable issue.
3. Put shared input types in `src/types.ts`, GitHub behavior in `src/api.ts`,
   and Pi tool registration/schema code in `src/tools.ts`.
4. Add or update tests under `tests/`.
5. Run the same checks as CI before committing:

   ```bash
   npm run verify
   npm audit --audit-level=high
   npm pack --dry-run
   ```

6. Run `npm run benchmark` for changes to parsing, matching, response shaping, or
   composite planning and report any material median change.
7. Follow [`docs/RELEASING.md`](docs/RELEASING.md) for version, changelog, tag,
   and upgrade requirements.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for module boundaries and
extension rules.

## Testing guidance

- Prefer unit tests for parsing, matching, safety decisions, and response
  shaping.
- Exercise mutations with `dryRun: true` whenever possible. A dry-run test must
  prove the operation can describe its intended change without credentials or
  network access.
- Do not use personal access tokens, real authorization headers, or production
  repository data in fixtures or snapshots.
- If a live integration check is unavoidable, use a disposable repository,
  record the manual steps in the pull request, and clean up through the normal
  GitHub review process.

## Authentication for manual checks

The extension resolves credentials in this order:

1. `GITHUB_TOKEN`
2. `GH_TOKEN`
3. `gh auth token`

Prefer the least-privileged, short-lived credential that can perform the check.
Never commit `.env` files, tokens, command output containing tokens, or local
Pi authentication files. Run `gh auth status` to diagnose CLI authentication;
do not paste `gh auth token` output into an issue or pull request.

## Pull request checklist

- [ ] The change is linked to an existing issue when one applies.
- [ ] Mutating behavior supports and tests `dryRun`.
- [ ] No credentials or sensitive response data are logged or committed.
- [ ] `npm run verify` passes, including coverage and release metadata checks.
- [ ] `npm audit --audit-level=high` passes.
- [ ] `npm pack --dry-run` contains only intended publish files.
- [ ] Performance-sensitive changes include benchmark evidence.
- [ ] Documentation and examples match the implemented behavior.
