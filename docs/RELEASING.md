# Release and changelog workflow

The project follows semantic versioning and records user-visible changes in `CHANGELOG.md`. The latest release line is supported; breaking changes require a major version.

## Prepare

1. Update `CHANGELOG.md` with a dated `## X.Y.Z - YYYY-MM-DD` section and grouped additions, changes, fixes, or security notes.
2. Set the same version in `package.json` and the lockfile (`npm version --no-git-tag-version X.Y.Z` is acceptable).
3. Document upgrade steps when tool names, input schemas, output fields, defaults, or required permissions change.
4. Run:

   ```bash
   npm ci
   npm run verify
   npm run benchmark
   npm audit --audit-level=high
   npm pack --dry-run
   ```

5. Inspect the package contents and generated tarball metadata. Do not publish from a dirty tree.

## Tag and publish

After the release change is reviewed and merged, create the annotated `vX.Y.Z` tag from the intended commit. Run `VERIFY_RELEASE_TAG=1 npm run verify:release` before publishing or creating the GitHub release. Publish and release actions are deliberate maintainer operations; CI validation does not publish automatically.

## Verify and recover

- Confirm the npm package version, Git tag, GitHub release, and changelog heading agree.
- Install the package in a clean Pi environment and run `github_get_auth` plus one dry-run operation.
- If validation fails before publication, fix metadata and rerun all checks.
- If an incorrect package is published, do not rewrite an existing tag. Deprecate the bad version when appropriate, fix forward with a new patch version, and document the correction.
- Never include credentials, local Pi state, coverage output, or benchmark artifacts in the package.
