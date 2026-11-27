# Recovery and troubleshooting

## No global rollback

The installer atomically replaces individual files but does not claim a global
multi-file transaction. A plan is idempotent and an interrupted run can resume
with the same input. Existing local files remain unless a confirmed managed
section changes.

## Resolving conflicts

For plugin artifacts, run `squad plugin verify` first. A checksum error stops the
documented update chain before `squad plugin install <newer-local-dir>`; Squad
does not provide automatic three-way merging for plugin files. Deliberately
keep the local state, restore the installed state, or explicitly reinstall after
review. `verify` and `list --json` expose the authoritative state. This guard
applies only to Squad-owned plugin targets.

If installed files under `.squad/templates/squad-heroes/companion/` are
corrupt, restore the complete plugin distribution through `squad plugin install`
after `verify`; that operation never installs root `scripts/`,
`.github/prompts/`, or `.github/workflows/`. Re-run the copied Companion
separately to review its activation plan and update those active targets.
Plugin uninstall intentionally leaves active targets and `.squad/heroes.json`
in place.

The copied Companion's `--dry-run` shows every active operation and conflict.
Record one decision per active target in JSON and pass it with `--decisions`:

```json
{
  ".squad/team.md": "use",
  ".github/workflows/heroes-ci.yml": "merge"
}
```

Only `use`, `keep`, `merge`, `abort` are accepted. `merge` is revalidated for
markers and UTF-8 before write.

## Common errors

- `detected "missing"`: marker file or marker is absent.
- `detected "0.13.1"` or another lower version: exit code 2. Stop without
  mutation and run `squad upgrade --self` as the normal user. If a root-owned
  global npm install reports `EACCES`/`EPERM`, use the safe global repair
  command from [Installation](installation.md#repairing-a-root-owned-global-squad-installation);
  do not run Squad itself under `sudo`.
- Exit code 2 also covers missing, duplicate, invalid or prerelease Squad
  versions; `2.0.0-rc.1` is not accepted.
- `gh_cli_missing`: install `gh`, then run the host browser/device login.
- `gh_auth_failed`: use the host browser/device login; never paste a token.
- `gh_repository_not_found`: the slug is wrong, the repo is absent, or the active
  account cannot see a private repo.
- `gh_repository_read_denied`: ask an owner to grant read/collaborator access.
- `gh_repository_push_denied`: readable repo, but an owner/maintainer must grant
  write/collaborator access.
- `gh_account_mismatch`: switch only to an already configured account, otherwise
  log in through the browser/device flow and select the expected identity.
- `gh_api_error`: retry and check host, VPN, DNS, and GitHub availability.
- `gh_project_scope`/`gh_project_access`, `project_missing`,
  `project_ambiguous`: Project scope/access or deterministic selection is
  missing. Refresh only the scope needed; create/share a Project or pass a
  validated `--project-number` for CI.
- `conflicts`: dry run and files unchanged; decision required.
- `ambiguous_markers`: duplicate, absent or reversed markers.
- `deployment_branch`: ref is invalid or ambiguous.
- `model_default`: explicit flow model ID is missing.
- `Plugin verification failed: checksum mismatch ...`: a Squad-owned installed
  plugin target changed locally; do not run `install`.
- `Permission denied` while resolving or running `squad`: restart the terminal
  after the global repair and verify `command -v squad`,
  `ls -l "$(command -v squad)"`, and `squad --version`. Do not recursively
  chmod npm's global tree. Only after these checks pass, run `squad upgrade` in
  the target repository and verify the marker.

For authentication failures, use only official host-side `gh auth login` or
`gh auth refresh` flows. Do not copy tokens, use `--with-token`, or type token
values into a terminal.

## Copy/paste GitHub preflight remediation

Every failed gate reports the host, the safe active login, repository slug,
sanitized verification result, and **No mutation started**. It never prints a
token, header, or full API response.

```sh
gh auth status --hostname github.com
gh api user --jq .login
gh api repos/OWNER/REPO --jq .permissions
gh repo view OWNER/REPO
```

- A `404` means the owner/name is wrong or the account cannot see the private
  repository. Ask an authenticated owner to verify it exists and grant
  collaborator access.
- A `200` response with `read: true` and `push: false` is not an owner-identity
  failure. Ask an owner or maintainer for write/collaborator access. Confirm the
  login with `gh api user --jq .login`; repository owner equality is not
  required.
- Missing/failed host login:
  `gh auth login --hostname github.com --web`.
- If the correct account is already configured:
  `gh auth switch --hostname github.com --user ACCOUNT`. Otherwise use the
  browser/device login and select that identity. CI/operator runs may pass
  `--expected-github-account ACCOUNT` when an identity is known; repository
  owner equality is never inferred automatically.
- Read-only Project selection:
  `gh auth refresh -h github.com -s read:project`.
- If documented Project setup mutates the Project:
  `gh auth refresh -h github.com -s project`.
- For API/network errors, retry after checking `github.com`, VPN, and DNS. Do
  not expose tokens, `Authorization` headers, or response bodies.
