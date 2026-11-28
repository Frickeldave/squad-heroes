# squad-heroes

A marketplace-ready Squad overlay and separately versioned, locally executed Companion for TypeScript projects.

## Scope

The Squad plugin lifecycle owns the static distribution under `.squad/templates/squad-heroes/companion/`. `squad plugin install` copies it but does not run the Companion. A later, explicit invocation of the copied installer materializes active targets such as `scripts/`, prompts, workflows, and agent charters.

The distribution contains the installer, runtime sources, scripts, workflows, resources, Humanizer files, and agents. JavaScript modules intentionally have no extension in the static bundle because Squad 2.0 rejects executable file extensions. The Companion writes active consumer scripts as `.mjs`.

## Quick start

Prerequisites: Node.js 20+, npm, stable Squad 2.0.0+, `git`, and authenticated `gh`.

```bash
git clone https://github.com/Frickeldave/squad-heroes.git /path/to/squad-heroes
squad plugin validate /path/to/squad-heroes
squad plugin dry-run /path/to/squad-heroes
squad plugin install /path/to/squad-heroes
squad plugin enable squad-heroes
squad plugin verify
```

The **plugin distribution plan** lists versioned files below `templates/squad-heroes/companion/`. Then plan and activate the installed Companion separately:

Every TTY installation starts with a project type menu containing exactly one entry: `001 Typescript developer project`. Noninteractive runs must explicitly pass `--project-type 001`; there is no implicit default that replaces the menu.

```bash
node .squad/templates/squad-heroes/companion/scripts/install \
  --target "$PWD" \
  --dry-run
node .squad/templates/squad-heroes/companion/scripts/install \
  --target "$PWD"
```

The second command writes only after approval of the **Companion activation plan**. Repeating it with unchanged input is a no-op.

CI and other noninteractive runs must provide complete model and branch input:

```bash
node .squad/templates/squad-heroes/companion/scripts/install \
  --target "$PWD" \
  --repository owner/repository \
  --project-type 001 \
  --language en \
  --deployment-branches 2 \
  --deployment-branch-1 main \
  --deployment-branch-2 int \
  --model-reqeng mai-code-2 \
  --model-work claude-sonnet-5.5 \
  --model-review gpt-6.1-terra \
  --dry-run
```

  Profile 001 is stored under `.squad/001/` in the consumer, including its profile, agents, and Humanizer. Active agent charters are materialized from it under `.squad/agents/`. ReqEng, Work, and Review remain one shared flow base and are not duplicated per type.

## Behavior

- **Installer language:** explicit `--language de|en` overrides an existing `.squad/heroes.json`; otherwise the installer uses the normalized system locale (`LC_ALL`, then `LC_MESSAGES`, then `LANG`, then `LANGUAGE`). Only German and American English are supported. Values are normalized only to `de` or `en`. Unsupported or ambiguous values fail; there is no silent mix or English fallback. If none is supported, rerun with `--language de` or `--language en`. External Squad/GitHub CLI output may be English; every Companion-owned message follows this contract.
- `--help` follows the same product-language rule. Both `--language de --help` and `--help --language de` are supported. Installer help never derives its language from the help text of another CLI.
- The Companion requires exactly one stable `<!-- version: X.Y.Z -->` marker in `.github/agents/squad.agent.md`, version 2.0.0 or later.
- Before menus, it checks `gh`, host authentication, account, repository permissions, and read-only Project API access. The writable `project` scope is required even for dry-run without board sync.
- Profile, language, branches, and the optional review baseline remain explicit. A baseline must resolve to a local commit.
- TTY selection uses arrows or `j`/`k`, Enter, Escape, and `q`; numeric input is not a selection method.
- Plans are concise: additions, merges, Project actions, no-ops, and totals. Raw JSON is opt-in through `--plan-json` or `--json-plan`.
- Local conflicts stop before writes. The TTY explains each target in plain language and selects the recommended merge. Details are optional and bounded; CI supplies internal decisions with `--decisions`.
- `--model ID` overrides one flow model for the current launcher invocation only.
- Tokens are never requested, stored, or emitted in logs.

Board sync derives the Project owner from `owner/repository`. It selects one Project automatically, shows a picker for multiple Projects, and offers Companion creation, manual creation, or cancellation when none exist. Only apply may create an external resource. See [Configuration](docs/en/configuration.md) and [Recovery](docs/en/recovery.md).

## Upgrade and removal

Squad 2.0 has no `plugin update` command. Reinstall the new distribution:

```bash
squad plugin verify
squad plugin install /path/to/newer/squad-heroes
squad plugin verify
```

This does not change active Companion targets. Review and activate those changes with the newly installed local installer. `squad plugin uninstall squad-heroes` removes only the plugin distribution, not active Companion files or `.squad/heroes.json`.

For a provably stale consumer copy:

```bash
git -C /path/to/squad-heroes pull --ff-only
squad plugin install /path/to/squad-heroes
squad plugin verify
sha256sum /path/to/squad-heroes/dist/companion/scripts/install
sha256sum .squad/templates/squad-heroes/companion/scripts/install
cmp /path/to/squad-heroes/dist/companion/scripts/install \
  .squad/templates/squad-heroes/companion/scripts/install
```

`cmp` must exit 0. Recovery after installation or Project failures is covered in [Recovery](docs/en/recovery.md).

## Documentation

- [Installation](docs/en/installation.md): lifecycle, installation, upgrade, and Project creation
- [Configuration](docs/en/configuration.md): state, models, prompt layers, and branches
- [Security](docs/en/security.md): ownership, permissions, and credentials
- [Recovery](docs/en/recovery.md): conflicts, common errors, and resume steps
- [Workflows](docs/en/workflows.md): CI, release, badges, ReqEng, and board sync
- [Non-goals](docs/en/non-goals.md)
- [End-to-end test plan](docs/en/testplan-snake.md) and [issue template](docs/en/testplan-snake-issue.md)

## Development

```bash
npm ci
npm run check
npm run smoke
squad plugin validate .
git diff --check
```

German documentation: [README-de.md](README-de.md).
