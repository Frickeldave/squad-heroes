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
corrupt, restore them through `squad plugin install` after `verify`; never
repair the active consumer targets from that operation. Re-run the copied
Companion separately to update active targets. Plugin uninstall intentionally
leaves active targets and `.squad/heroes.json` in place.

`--dry-run` shows every operation and conflict. Record one decision per target in
JSON and pass it with `--decisions`:

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
- `gh_permission`: push permission cannot be proven.
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

For authentication failures, use only the official `gh auth login`
browser/device flow. Do not copy tokens or type them into a terminal.
