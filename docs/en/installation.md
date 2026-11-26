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

`.squad/heroes.json` preserves the one-time profile identity. Profile changes
require uninstall/reinstall. Existing charters, team sections and workflows
change only inside managed markers; local bytes survive.
