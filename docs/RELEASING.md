# Release and changelog workflow

The project follows semantic versioning and records user-visible changes in `CHANGELOG.md`. The latest release line is supported; breaking changes require a major version.

## Prepare

1. Replace `Unreleased` entries as appropriate with a dated `## X.Y.Z - YYYY-MM-DD` section. That exact section is the only source for GitHub release notes.
2. Set the same version in `package.json` and both lockfile version fields (`npm version --no-git-tag-version X.Y.Z` is acceptable).
3. Document upgrade steps when tool names, schemas, output fields, defaults, or permissions change.
4. Run:

   ```bash
   npm ci
   npm run verify
   npm run benchmark
   npm audit --audit-level=high
   npm pack --dry-run
   node scripts/extract-release-notes.mjs vX.Y.Z
   ```

5. Inspect package contents and generated tarball metadata. Do not release from a dirty tree.

## Automated GitHub release

After the release commit is reviewed and merged, create an annotated, immutable `vX.Y.Z` tag at that commit and push the tag. `.github/workflows/release.yml` then:

- checks out the exact tagged commit with least-privilege `contents: write` permission;
- verifies package, lockfile, tag, and dated changelog agreement before release creation;
- reruns type checking, tests, coverage, audit, benchmark policy, and package inspection;
- extracts notes from only the matching changelog section;
- creates exactly one GitHub release and attaches the generated package tarball; and
- verifies that the release tag and tarball asset exist.

The workflow has no npm token and no `npm publish` command. npm publication, if ever approved, remains a separate explicit maintainer operation.

## Failure recovery

- If validation fails before release creation, fix forward on `main`, choose a new version/tag when the tagged commit must change, and rerun all checks.
- Never move, delete, or rewrite a release tag as recovery.
- If release creation succeeded but asset upload was interrupted, rerunning the workflow detects the existing release and idempotently replaces only the same tarball asset; it does not create a duplicate release.
- If notes or package contents are wrong after release creation, publish a correcting patch release and explain the superseded artifact. Do not silently rewrite release history.
- If an npm package is ever published incorrectly, deprecate it when appropriate and fix forward with a patch version.

## Manual verification

```bash
EXPECTED_RELEASE_TAG=vX.Y.Z VERIFY_RELEASE_TAG=1 npm run verify:release
node scripts/extract-release-notes.mjs vX.Y.Z release-notes.md
npm pack --json
```

Confirm the npm package version, Git tag, GitHub release, changelog heading, scoped notes, and attached tarball agree. Install the tarball in a clean Pi environment and run `github_get_auth` plus one dry-run operation. Never include credentials, local Pi state, coverage output, or benchmark artifacts in the package.
