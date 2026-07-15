# Offline GitHub Actions validation

Every `.yml` and `.yaml` file directly under `.github/workflows/` is validated before the repository's TypeScript and test gates run. The validator reads only checked-in files and installed packages: after `npm ci`, it makes no network requests and needs no downloaded executable, container, GitHub token, or live repository.

Run the same entry point used by `npm run verify` and CI:

```bash
npm ci
npm run verify:workflows
```

The command fails if no workflow files are found. Diagnostics use GitHub-style `file:line:column` locations. Tests include malformed YAML, invalid workflow semantics, a mutable action reference, and a pin without review provenance.

## Validator and schema provenance

The validation toolchain is exact-versioned in `devDependencies` and integrity-pinned by `package-lock.json`:

| Component | Version and lock integrity | Provenance | License | Purpose |
|---|---|---|---|---|
| `actionlint` | `2.0.6`; `sha512-tNx8f48yJNSLXTIygGntu5dSZlIZblDt8sR7pIs7EEmmb2PkEF87d+3UKZV2GUgCuN9Awj7k4ZPrwdAxFWEqgw==` | npm package `actionlint@2.0.6`, whose `main.wasm` embeds the GitHub Actions schema and semantic/expression engine; registry tarball `https://registry.npmjs.org/actionlint/-/actionlint-2.0.6.tgz` | MIT | Workflow structure, event/job/step contracts, contexts, and expressions |
| `yaml` | `2.9.0`; `sha512-2AvhNX3mb8zd6Zy7INTtSpl1F15HW6Wnqj0srWlkKLcpYl/gMIMJiyuGq2KeI2YFxUPjdlB+3Lc10seMLtL4cA==` | [`eemeli/yaml`](https://github.com/eemeli/yaml), distributed as `yaml@2.9.0` | ISC | Strict local YAML parsing, duplicate-key detection, and source locations for repository policy |
| Repository policy | Current source in `scripts/verify-workflows.mjs` | This repository | MIT | Complete workflow discovery plus immutable remote `uses:` references and adjacent review comments |

The npm `actionlint@2.0.6` metadata does not identify an upstream repository or embedded engine revision. The lockfile integrity, installed tarball, license, and fixture behavior are therefore the reviewed provenance boundary; an update must not assume equivalence solely from the package name. No schema is fetched at validation time.

Both validator packages are development-only. They are not imported by `extensions/` or `src/`, no runtime API changes, and the package `files` allowlist is unchanged.

## Immutable workflow references

Remote GitHub actions and reusable workflows must use a full lowercase 40-character commit SHA. Container actions must use a full lowercase `sha256` digest. Each immutable reference also needs a trailing reviewed release or digest comment, for example:

```yaml
uses: actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd # v5.0.1
```

Local actions beginning with `./` are allowed. Tags, branches, shortened SHAs, uppercase SHAs, and unreviewed immutable references fail locally.

Reviewed action state on 2026-07-15:

| Action | Release | Commit SHA | Publisher |
|---|---|---|---|
| `actions/checkout` | [`v5.0.1`](https://github.com/actions/checkout/releases/tag/v5.0.1) | `93cb6efe18208431cddfb8368fd83d5badbf9bfd` | GitHub (`actions`) |
| `actions/setup-node` | [`v5.0.0`](https://github.com/actions/setup-node/releases/tag/v5.0.0) | `a0853c24544627f65ddf259abe73b1d18a591444` | GitHub (`actions`) |

## Known diagnostics and exceptions

No actionlint diagnostic is currently suppressed. The wrapper does contain one narrow fail-safe for a validator defect: `actionlint@2.0.6` can trap inside WebAssembly on malformed flow-style YAML. Strict `yaml@2.9.0` parsing therefore runs first, and actionlint is skipped only when that parser has already produced source-located errors. `tests/fixtures/workflows/malformed.yml` reproduces the trap input and proves the fallback reports its file and line. Syntactically valid workflows always reach actionlint and the local immutable-reference policy.

The pinned WebAssembly package is also known to predate recognition of GitHub's valid top-level `vars` context, but this repository does not currently use that context and does not filter the diagnostic. A future `vars` use must prefer a reviewed validator update. If an update is not possible, any exception must match the exact diagnostic kind and message, document why GitHub accepts the construct, and add both a positive fixture for that one construct and negative fixtures proving expression validation still fails closed. Broad kind-, file-, or substring-based filtering is prohibited.

## Update review procedure

1. Update one validator or action pin at a time. For validators, keep the version exact in `package.json` and regenerate `package-lock.json` with the supported npm version.
2. Verify the registry tarball URL, integrity, package license, publisher/source ownership, and the package diff. For `actionlint`, explicitly review or record any newly published upstream/engine provenance because `2.0.6` does not provide it.
3. For action updates, review the official release notes, changed inputs/permissions/runtime, publisher ownership, and tag-to-commit mapping. Keep the full SHA and update its trailing release comment and the reviewed-action table together.
4. Review schema/diagnostic changes against GitHub's workflow syntax documentation. Add focused fixtures for corrected false positives or newly enforced semantics; never weaken the repository pin policy to accommodate an unrelated diagnostic.
5. From a clean install, run `npm run verify:workflows`, `npm run verify`, `npm audit --audit-level=high`, and `npm pack --dry-run`. Confirm the workflow command still succeeds with npm offline after `npm ci`.
6. Accept an update only after read-only pull-request CI passes. Permission changes, new secrets, or mutable references require separate security review.
