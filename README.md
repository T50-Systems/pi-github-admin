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
- PR-to-issue linking
- merge-ready PR merging
- PR checks inspection
- safe branch deletion / cleanup

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
- `github_comment_issue`
- `github_comment_pr`
- `github_edit_comment`
- `github_delete_comment`
- `github_delete_branch`
- `github_create_release`
- `github_link_pr_issues`
- `github_merge_pr_when_ready`
- `github_get_pr_checks`
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
- PR issue linking verifies referenced issues exist by default and avoids duplicate body entries
- PR merging can require clean mergeability and all check runs to be successful before merging

## PR discipline workflow

> Use these tools before merging work so every PR has traceable issue context and merges only after checks pass.

```json
github_link_pr_issues({
  "repo": "T50-Systems/casas-portales-inmobiliarios-rd",
  "pullNumber": 720,
  "issueNumbers": [548],
  "keyword": "refs",
  "requireExistingIssues": true
})
```

```json
github_merge_pr_when_ready({
  "repo": "T50-Systems/casas-portales-inmobiliarios-rd",
  "pullNumber": 720,
  "method": "squash",
  "deleteBranch": true,
  "requireClean": true,
  "requireChecksSuccess": true
})
```

```json
github_delete_branch({
  "repo": "T50-Systems/casas-portales-inmobiliarios-rd",
  "branch": "chore/cleanup-stale-branch",
  "requireMerged": true
})
```

```json
github_get_pr_checks({
  "repo": "T50-Systems/casas-portales-inmobiliarios-rd",
  "pullNumber": 737
})
```

Criteria baked into the workflow:
- do not create a new issue if an existing issue applies
- link the existing issue in the PR body before merge
- prefer `refs` for related/already-closed issues and `closes` only when this PR should close the issue
- merge only when the PR is open, mergeable, and required checks are successful

## Example

```ts
github_comment_issue({
  repo: "T50-Systems/repuestos",
  issueNumber: 218,
  body: "Documentado localmente en docs/specs/issue-218.md",
});

github_comment_pr({
  repo: "T50-Systems/repuestos",
  pullNumber: 217,
  body: "Listo para revisión.",
});

github_edit_comment({
  repo: "T50-Systems/repuestos",
  commentId: 123456789,
  body: "Texto corregido",
});

github_delete_comment({
  repo: "T50-Systems/repuestos",
  commentId: 123456789,
});
```

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
