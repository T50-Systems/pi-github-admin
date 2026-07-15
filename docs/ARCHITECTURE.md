# Architecture

## Purpose and boundaries

`pi-github-admin` is a Pi extension that exposes typed tools for a focused set of
GitHub repository administration operations. It translates Pi tool inputs into
GitHub REST API requests and returns structured results suitable for an agent.
It does not run a server, persist state, or own repository policy outside the
explicit request being handled.

## Components

| Path | Responsibility | Must not own |
| --- | --- | --- |
| `extensions/index.ts` | Package entry point used by Pi. | Tool behavior or GitHub API calls. |
| `src/index.ts` | Registers the extension and exports the stable public TypeScript API. | Request schemas or network implementation. |
| `src/tools.ts` | Thin stable Pi registration facade. | Resource behavior. |
| `src/tool-domains/` and `src/tool-registrations.ts` | Resource catalog, domain schemas/handlers, and compatibility registration implementation. | GitHub REST transport. |
| `src/api.ts` and `src/api-domains/` | Thin stable API facade and resource exports for repositories, issues, PRs/comments, branches/protection, releases, and verification/composition. | Authentication discovery or Pi registration. |
| `src/api-operations.ts` | Compatibility implementation used by the resource modules; composition calls smaller exported operations. | Pi registration. |
| `src/http.ts` | Authenticated request transport, typed sanitized errors, bounded timeout/retry policy, and guarded Link pagination. | Resource policy or Pi formatting. |
| `src/security.ts` | Repository security-control apply/verify operations. | Live setting changes without an explicit call. |
| `src/auth.ts` | Resolves credentials and reports authentication/access diagnostics. | Business operations against repositories. |
| `src/types.ts` | Defines shared inputs and result-related types. | Runtime behavior. |
| `tests/` | Verifies mocked request boundaries, dry runs, guards, pagination, and tool contracts. | Live mutation of GitHub resources. |

The dependency direction is intentionally one way:

```text
extensions/index.ts -> src/index.ts
  -> src/tools.ts -> tool domain catalog/registrations
       -> src/api.ts -> resource domain modules
            -> api operations / security operations
                 -> src/http.ts -> src/auth.ts
  -> src/types.ts
```

`src/index.ts` also re-exports the API, authentication helpers, and types for
programmatic consumers.

## Request and control flow

1. Pi loads `extensions/index.ts`, which forwards to the default export from
   `src/index.ts`.
2. `registerGitHubAdminTools` registers each tool name, description, and input
   schema.
3. A tool handler passes validated input to the matching resource-domain export
   behind `src/api.ts`.
4. Mutating operations return a plan before auth or HTTP when `dryRun` is true.
   Otherwise they use `src/http.ts`, which resolves auth, applies bounded transport
   policy, and returns typed structured failures.
5. The handler returns a structured result to Pi. Authentication diagnostics
   may include the credential source, but never the credential value.

Composite operations, such as repository shipping, remain in the API layer and
compose smaller operations rather than bypassing their validation and dry-run
semantics.

## Safety and extension rules

When adding or changing a tool:

- Define or update its shared input type in `src/types.ts`.
- Keep resource behavior in the matching `src/api-domains/` boundary, transport in
  `src/http.ts`, and Pi schemas/registration in the matching `src/tool-domains/` boundary.
- Add `dryRun` to mutations and ensure dry runs do not resolve credentials or
  make network requests.
- Prefer idempotent create-or-update behavior where GitHub supports it.
- Use `parseRepo` for `owner/name` validation and the shared request helper for
  consistent headers and error messages.
- Never include tokens, authorization headers, or secret environment values in
  results, errors, fixtures, or logs.
- Add unit coverage for pure decisions and dry-run paths. Live GitHub mutation
  is a manual integration check and must use a disposable repository.
- Register new tools through `src/tools.ts` and confirm public exports through
  `src/index.ts` when programmatic access is intended.
- Treat security capability diagnostics as an additive contract: retain legacy booleans
  and `ok`, emit only sanitized closed reasons/status, and keep masked 404 capability
  unknown as recorded in [`SECURITY_CAPABILITY_RESULTS.md`](SECURITY_CAPABILITY_RESULTS.md).

## Validation boundary

The required local and CI checks are:

```bash
npm ci
npm run verify
npm audit --audit-level=high
npm pack --dry-run
```

`npm run verify` runs type checking, the Vitest suite with committed coverage
thresholds, and release/changelog metadata verification. CI runs the same checks on
pull requests and pushes to `main`. `npm run benchmark` runs the helper microbenchmarks
and the deterministic guarded-pagination measurement but does not enforce a shared-runner
budget. CI uploads the nonblocking hosted pagination baseline described in
[`PAGINATION_BENCHMARK.md`](PAGINATION_BENCHMARK.md).
There is no separate compile or bundle artifact: Pi loads the TypeScript extension
entry point declared in `package.json`.
