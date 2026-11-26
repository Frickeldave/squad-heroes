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
immediately before the first write. Exactly one `2.0.0` marker is accepted.
Otherwise it exits with code 2 and exactly:

`ERROR: squad-heroes requires Squad 2.0.0 exactly; detected
"<value|missing|multiple|invalid>". Installation aborted before mutation.`

No backup, journal, lock or partial installation is created.

It then runs `gh auth status` and a non-mutating repository query. Failure only
refers to the host-side `gh auth login` flow.

## First installation

```bash
git clone https://github.com/Frickeldave/squad-heroes.git
cd /repo
squad plugin validate /path/to/squad-heroes
squad plugin dry-run /path/to/squad-heroes
squad plugin install /path/to/squad-heroes
squad plugin enable squad-heroes
squad plugin list --json
squad plugin verify
```

`squad plugin install <local-dir>` is the only plugin installation path. The
obsolete `plugin-setup.mjs` proprietary wrapper is no longer shipped.

The human-triggered companion follows as a separate operation:

```bash
node scripts/install.mjs --target /repo --repository owner/repository \
  --deployment-branches 1 --deployment-branch-1 prd \
  --language en --dry-run
```

`TypeScript Development` is the only MVP profile and installs Tony, Pepper,
Bruce, Clint, Maria, Natasha and Nick. `Client` is never used. Both language
variants are materialized; `--language` selects active `charter.md` and runtime
output.

Missing, duplicate or ambiguous branch inputs stop before the first write.

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
