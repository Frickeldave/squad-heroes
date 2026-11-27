# Installation

## Architecture

The plugin owns only versioned static files below `.squad/heroes/`. The
companion owns materialized active targets such as agents, `.github/prompts/`,
workflows and scripts. Squad `.squad/plugins/*` remains the only plugin
lifecycle source.

Agent/prompt sources, companion adapters, launchers/automation and
documentation/quality are four portions of the same overlay and share one
version. They are not four separate installation products.

## Preflight

The installer reads `.github/agents/squad.agent.md` before planning and
immediately before the first write. Exactly one valid stable SemVer marker at
least `2.0.0` is accepted, including versions such as `2.0.1` and `3.0.0`.
Build metadata is ignored for precedence; prerelease markers are rejected.
Otherwise it exits with code 2 and reports:

`ERROR: squad-heroes minimum Squad version 2.0.0 is required; detected
"<value|missing|multiple|invalid>". Installation aborted before mutation.`

No backup, journal, lock or partial installation is created.

The diagnosis tells the operator to run `squad upgrade --self` as the normal
user, repair a root-owned global npm installation when necessary, then upgrade
the target repository. It does not authorize running Squad itself with `sudo`.

It then runs `gh auth status` and a non-mutating repository query. Failure only
refers to the host-side `gh auth login` flow.

## First installation

There are two separate read-only dry-runs. `squad plugin dry-run` plans only
static marketplace templates. `scripts/install.mjs --dry-run` plans active
Companion targets, including `scripts/`, `.github/prompts/`, workflows and
materialized agent files. Review both plans before installation; the plugin
dry-run is not the complete delivery plan.

```bash
git clone https://github.com/Frickeldave/squad-heroes.git
cd /repo
node /path/to/squad-heroes/scripts/plugin-preflight.mjs --target "$PWD"
squad plugin validate /path/to/squad-heroes
# Static plugin targets only:
squad plugin dry-run /path/to/squad-heroes
node /path/to/squad-heroes/scripts/install.mjs \
  --target "$PWD" --repository owner/repository \
  --profile typescript-development \
  --deployment-branches 1 --deployment-branch-1 prd \
  --language en --dry-run
node /path/to/squad-heroes/scripts/plugin-preflight.mjs --target "$PWD"
squad plugin install /path/to/squad-heroes
squad plugin enable squad-heroes
squad plugin list --json
squad plugin verify
```

`plugin-preflight.mjs` is only a read-only compatibility and manifest gate; it
does not install anything and owns no plugin lifecycle. Running it twice proves
the early and final check immediately around the verified dry-run. `squad
plugin install <local-dir>` is the only plugin installation path.

The second dry-run must contain active targets such as
`scripts/start-work.mjs` and `.github/workflows/heroes-ci.yml`. The
human-triggered companion then follows as a separate operation using the
already reviewed command without `--dry-run`:

```bash
node scripts/install.mjs --target /repo --repository owner/repository \
  --profile typescript-development \
  --deployment-branches 1 --deployment-branch-1 prd \
  --language en --dry-run
```

`TypeScript Development` is the only MVP profile and installs Tony, Pepper,
Bruce, Clint, Maria, Natasha and Nick. `Client` is never used. Both language
variants are materialized; `--language` selects active `charter.md` and runtime
output.

Missing, duplicate or ambiguous branch inputs stop before the first write.

## Repairing a root-owned global Squad installation

Run `squad upgrade --self` first as the normal user. If the global npm package
is owned by root and npm reports `EACCES` or `EPERM` while renaming it, do not
rerun the CLI under `sudo`. With npm versions that support `--allow-scripts`,
repair the global installation once with the verified, command-specific
allowlist:

```bash
sudo sh -c 'umask 022 && exec npm install -g --allow-scripts=@bradygaster/squad-cli,node-pty,koffi,protobufjs @bradygaster/squad-cli@latest'
```

The explicit `umask 022` matters: an inherited restrictive umask can recreate
the package and launcher target as owner-only (`750`), which makes `/usr/bin/squad`
resolve successfully for `root` but fail with `Permission denied` for a normal
user. The allowlist covers the four packages in this dependency tree that have
install-time scripts (`@bradygaster/squad-cli`, `node-pty`, `koffi`, and
`protobufjs`); it does not weaken npm's persistent global policy.

Restart the terminal or shell so its command cache and environment are refreshed,
then verify the repaired launcher before any project upgrade:

```bash
command -v squad
ls -l "$(command -v squad)"
squad --version
```

Only after these commands succeed, run `squad upgrade` in the target repository
and verify that exactly one stable SemVer marker of at least `2.0.0` remains.
Do not run a recursive `chmod` on npm's global directory and do not use
`--dangerously-allow-all-scripts`. For a remaining `Permission denied`, stop,
inspect the symlink with `ls -l`, and rerun the one repair command with an
explicit `umask`; do not guess at individual dependency permissions.

## Upgrade

The installed Squad CLI has no `plugin update` command. Update from a newer
checkout by installing that directory again:

```bash
squad plugin verify &&
squad plugin install /path/to/newer/squad-heroes &&
squad plugin verify
squad plugin list --json
```

Running `verify` before `install` stops an update if a Squad-owned installed
file has a local checksum conflict. Squad owns version, manifest and file
checksums in `.squad/plugins/*`; repeated `install` registers the newer source
and content there. Companion files are untouched. Reinstalling identical
content is idempotent for delivered targets, although Squad records a fresh
install timestamp/audit event.

`.squad/heroes.json` preserves the one-time profile identity. Profile changes
require uninstall/reinstall. Existing charters, team sections and workflows
change only inside managed markers; local bytes survive.
