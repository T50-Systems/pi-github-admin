# pi-github-admin

Pi-native GitHub admin tools for:
- repo creation
- repo metadata
- branch protection
- labels
- milestones
- issues
- releases
- final repo verification
- end-to-end repo bootstrapping

## Why this package exists

Using raw `gh`, ad-hoc JSON, and one-off shell commands from an agent works, but it is noisy and brittle.

`pi-github-admin` wraps the most common GitHub repository administration tasks in Pi tools with:
- declarative inputs
- idempotent behavior where practical
- consistent verification
- cleaner error messages
- dry-run support for mutating operations

## Install

```bash
pi install /absolute/path/to/pi-github-admin
```

## Auth

The package resolves GitHub auth in this order:
1. `GITHUB_TOKEN`
2. `GH_TOKEN`
3. `gh auth token`

`github_get_auth` can also inspect access to a specific repo and report scopes plus suggested remediation.

## Tools

- `github_get_auth`
- `github_create_repo`
- `github_set_repo_metadata`
- `github_protect_branch`
- `github_create_labels`
- `github_create_milestone`
- `github_create_issue`
- `github_create_release`
- `github_verify_repo_state`
- `github_ship_repo`

## Current scope

This package now covers the smallest high-value GitHub admin workflow end to end:
- create a repo
- set metadata
- sync labels
- create milestones and issues
- protect a branch
- create or update a release
- verify final state
- optionally run the whole workflow as one declarative `github_ship_repo` call

## Notable behavior

- auth diagnostics can optionally inspect access to a specific repo
- issue and release duplicate detection normalize title/body text instead of matching only exact raw strings
- dry-run mode is available on mutating tools
- verification returns richer detail instead of only booleans

## Proposed next improvements

- safer presets for common branch-protection policies
- clearer organization-level permission diagnostics for repo creation
- optional diff output for dry-run results
- GitHub Projects support

## Development

```bash
npm install
npm run typecheck
npm test
```
