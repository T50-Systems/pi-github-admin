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
| `src/index.ts` | Registers the extension and exports the public TypeScript API. | Request schemas or network implementation. |
| `src/tools.ts` | Defines TypeBox schemas, registers Pi tools, and adapts tool results for Pi. | GitHub REST details or authentication discovery. |
| `src/api.ts` | Implements GitHub operations, dry runs, idempotency checks, and response shaping. | Pi registration or credential discovery. |
| `src/auth.ts` | Resolves credentials and reports authentication/access diagnostics. | Business operations against repositories. |
| `src/types.ts` | Defines shared inputs and result-related types. | Runtime behavior. |
| `tests/` | Verifies pure helpers, dry-run behavior, and package exports. | Live mutation of GitHub resources. |

The dependency direction is intentionally one way:

```text
extensions/index.ts
  -> src/index.ts
       -> src/tools.ts
            -> src/api.ts
                 -> src/auth.ts
            -> src/types.ts
```

`src/index.ts` also re-exports the API, authentication helpers, and types for
programmatic consumers.

## Request and control flow

1. Pi loads `extensions/index.ts`, which forwards to the default export from
   `src/index.ts`.
2. `registerGitHubAdminTools` registers each tool name, description, and input
   schema.
3. A tool handler passes validated input to the matching function in
   `src/api.ts`.
4. Mutating operations return a plan without contacting GitHub when `dryRun` is
   true. Otherwise the API layer asks `src/auth.ts` for a token and calls the
   GitHub REST API.
5. The handler returns a structured result to Pi. Authentication diagnostics
   may include the credential source, but never the credential value.

Composite operations, such as repository shipping, remain in the API layer and
compose smaller operations rather than bypassing their validation and dry-run
semantics.

## Safety and extension rules

When adding or changing a tool:

- Define or update its shared input type in `src/types.ts`.
- Keep GitHub HTTP behavior in `src/api.ts`; keep Pi schemas and registration in
  `src/tools.ts`.
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
pull requests and pushes to `main`. `npm run benchmark` is required for
performance-sensitive helper or planning changes but is not a shared-runner gate.
There is no separate compile or bundle artifact: Pi loads the TypeScript extension
entry point declared in `package.json`.
