# pi-github-admin

Pi-native GitHub admin tools for:
- repo metadata
- branch protection
- labels
- milestones
- issues
- releases
- final repo verification

## Why this package exists

Using raw `gh`, ad-hoc JSON, and one-off shell commands from an agent works, but it is noisy and brittle.

`pi-github-admin` wraps the most common GitHub repository administration tasks in Pi tools with:
- declarative inputs
- idempotent behavior where practical
- consistent verification
- cleaner error messages

## Install

```bash
pi install /absolute/path/to/pi-github-admin
```

## Auth

The package resolves GitHub auth in this order:
1. `GITHUB_TOKEN`
2. `GH_TOKEN`
3. `gh auth token`

## Tools

- `github_get_auth`
- `github_set_repo_metadata`
- `github_protect_branch`
- `github_create_labels`
- `github_create_milestone`
- `github_create_issue`
- `github_create_release`
- `github_verify_repo_state`

## Initial scope

This first version intentionally focuses on the smallest useful set of operations that repeatedly caused friction in real agent workflows.

## Proposed next improvements

- add `github_create_repo`
- add a composite `github_ship_repo` tool
- add better duplicate detection policies for issues and releases
- add richer repo verification policies
- add optional dry-run mode

## Development

```bash
npm install
npm run typecheck
npm test
```
