# Recovery and troubleshooting

## Stop and resume safely

Files are replaced individually and atomically; there is no global rollback. Resume an interrupted run with identical input. Existing local content remains without a confirmed decision.

On failure, stop active commands/jobs, save the message and exit code, and stop mutating resources if ownership is unclear.

## Plugin recovery

```bash
squad plugin verify
squad plugin list --json
```

On `checksum mismatch`, do not install. Keep the conflict and either restore the installed state deliberately or reinstall the complete plugin state after review:

```bash
squad plugin install /path/to/squad-heroes
squad plugin verify
```

That restores only `.squad/templates/squad-heroes/companion/`. It does not repair root `scripts/`, `.github/prompts/`, or `.github/workflows/`; run the local Companion separately in dry-run and apply mode for those targets.

Conflicts in profile sources under `.squad/001/` use the same Companion recovery rules. Re-materialize restored agents and skills from those sources.

## Companion conflicts

Unresolved conflicts stop before writes. The normal TTY view explains the target, the proposed change, and the recommendation in plain language. Merge is selected first for managed sections. `Show details / diff` is optional and bounded. The UI never requires users to interpret `owner`, `actionDetails`, escaped file bodies, or raw plan JSON.

TTY selection uses arrows or `j`/`k`, Enter, and Escape/`q`. CI uses the internal decision values in a file:

```json
{
  ".squad/team.md": "use",
  ".github/workflows/heroes-ci.yml": "merge"
}
```

```bash
node .squad/templates/squad-heroes/companion/scripts/install \
  --target "$PWD" \
  --decisions .squad/heroes-decisions.json \
  --dry-run
```

Apply stores the confirmed map in `.squad/heroes.json`. `merge` is revalidated for markers and UTF-8; `history.md` remains append-only.

## Error codes

| Error | Recovery |
| --- | --- |
| `detected "missing"`, duplicate/invalid marker, prerelease, or version below 2.0.0 | Stop without mutation, upgrade Squad normally, and recheck the marker. |
| `gh_cli_missing` | Install `gh` and use the official login. |
| `gh_auth_failed` | Run `gh auth login --hostname github.com --web`; never paste a token. |
| `gh_repository_not_found` | Check owner/repository, visibility, and private access. |
| `gh_repository_read_denied` / `push_denied` | Ask an owner for read/collaborator or write access. |
| `gh_account_mismatch` | Select an existing account with `gh auth switch` or use the official login. |
| `gh_api_error` | Check GitHub, VPN, DNS, and network, then retry. |
| `gh_project_scope`, `project_access`, `project_missing`, `project_ambiguous` | Refresh scope, verify selection, or provide a validated Project number. |
| `conflicts` / `ambiguous_markers` | Inspect dry-run and markers; a decision is required. |
| `deployment_branch` | Correct the ref or branch argument. |
| `model_default` | Provide an explicit flow model ID. |

## GitHub preflight

```bash
gh auth status --hostname github.com
gh api user --jq .login
gh api repos/OWNER/REPO --jq .permissions
gh repo view OWNER/REPO
```

- 404: wrong slug or invisible private repository; ask an owner to grant access.
- `read: true`, `push: false`: the repository is visible but write access is missing. An owner must grant collaborator access; owner equality is not required.
- Correct existing account: `gh auth switch --hostname github.com --user ACCOUNT`.
- Missing `project` scope:

```bash
gh auth refresh -h github.com -s project
gh auth status --hostname github.com
```

Errors include only a safe login, host, slug, and sanitized result: **No mutation started**. Do not copy tokens or authorization headers.

## Partial Project state

Project creation is externally visible and is not globally rolled back. After a failure in creation, schema, or linking:

```bash
gh project list --owner OWNER --limit 100 --format json
```

Inspect the existing number, title, schema, and repository link. Rerun with a confirmed `--project-number`; do not blindly recreate. Successful state stores the real number and recovery baselines in `.squad/heroes.json`.

## Squad launcher

For `Permission denied`, record the symlink and target. Run `squad upgrade --self` as the normal user; only a root-owned npm package may require the bounded repair from [Installation](installation.md#repair-the-squad-launcher). Restart the terminal and verify:

```bash
command -v squad
ls -l "$(command -v squad)"
squad --version
```

Only then run `squad upgrade` in the consumer. Do not use recursive `chmod` or `sudo squad`.
