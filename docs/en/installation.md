# Installation

## Prerequisites

- Node.js 20+, npm, Linux, and `git`.
- Stable Squad 2.0.0 or later.
- Authenticated `gh` with repository read/push permission.
- Writable `project` scope, including for a full dry-run. `read:project` only supports isolated reads.
- Exactly one stable `<!-- version: X.Y.Z -->` marker in `.github/agents/squad.agent.md`.

The Companion checks these gates before menus and writes. It never asks for tokens.

TTY installation starts before auth or configuration prompts with the "Project type" arrow-key menu. It currently contains exactly `001 Typescript developer project`. Non-TTY operation must explicitly pass `--project-type 001`; no implicit default replaces the menu.

## Installer language

The exact priority is explicit `--language de|en` > the language in an existing `.squad/heroes.json` > normalized system locale (`LC_ALL`, then `LC_MESSAGES`, then `LANG`, then `LANGUAGE`). Only `de` and `en` are supported; locale forms such as `en_US.UTF-8` normalize only to `en`. Explicit and stored values must be exactly `de` or `en`. Unsupported or ambiguous values fail clearly. There is no silent language mix, partial translation, or English fallback. If no usable source exists, rerun with `--language de` or `--language en`. External Squad/GitHub CLI language is outside this product contract.

Help is not a special case: `--language de --help` and `--help --language de` produce German Companion help; the equivalent applies to `en`. Companion help never adopts the language of external `ls --help`, `gh help`, or similar output.

## Install the plugin

```bash
git clone https://github.com/Frickeldave/squad-heroes.git /path/to/squad-heroes
squad plugin validate /path/to/squad-heroes
squad plugin dry-run /path/to/squad-heroes
squad plugin install /path/to/squad-heroes
squad plugin enable squad-heroes
squad plugin verify
```

This **plugin distribution plan** targets only `templates/squad-heroes/companion/`. It contains the installer, runtime, scripts, workflows, Humanizer files, and resources, but does not change active root scripts or `.github/` files.

## Activate the Companion

```bash
node .squad/templates/squad-heroes/companion/scripts/install \
  --target "$PWD" \
  --dry-run
```

The separate **Companion activation plan** is a concise summary, not a raw JSON dump. It groups files to add, existing files to merge, Project actions, unchanged files, and totals:

```text
Plan: 82 add, 2 merge, 0 unchanged, 0 Project actions, 0 conflicts; Project state: off.
Examples: scripts/start-work.mjs, .github/workflows/heroes-ci.yml, .github/prompts/startwork.prompt.md.
Dry run: 82 add, 2 merge, 0 unchanged, 0 Project actions, 0 conflicts; no changes.
```

Normal output shows at most three representative paths and never the complete target list. `--plan-json plan.json` retains every technical entry; that detail mode must be selected explicitly.

Review it, then run the same command without `--dry-run`. Only that step writes. Repeating unchanged input is a no-op. Use `--plan-json plan.json` to write the machine-readable plan to a file, or `--json-plan` for explicit JSON on stdout.

TTY menus use arrows or `j`/`k`, Enter, Escape, and `q`. Without a TTY, model and Project flags are required:

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

Conflicts stop before writes. Each target gets at most two or three short sentences, then the picker and one completion line. For `.squad/team.md`, the installer states that the managed Squad Heroes section is absent and recommends inserting seven agents while preserving existing content. The picker starts on `Merge — recommended: add to the existing file`; after selection, it prints one completion line. Routing follows the same compact pattern. `Show details / diff` remains optional and bounded, and is not selected by default.

CI passes the internal decision values through `--decisions`:

```json
{
  ".squad/team.md": "merge",
  ".squad/routing.md": "merge"
}
```

Activation copies the bundled `.squad/heroes/001/` source into the consumer's `.squad/001/`. Agent charters are materialized from that namespace under `.squad/agents/`, and Humanizer is installed under `.github/skills/humanizer/`. Shared ReqEng, Work, and Review launchers, prompts, and workflows remain singletons in the shared bundle.

## Create a Project

With no Projects, the wizard offers Companion creation, manual creation, or cancellation. It derives the owner from `--repository`. CI requires `--create-project` and `--project-title`; the external write occurs only without `--dry-run` after plan approval.

```bash
node .squad/templates/squad-heroes/companion/scripts/install \
  --target "$PWD" \
  --repository owner/repository \
  --enable-board-sync \
  --project-type 001 \
  --language en \
  --deployment-branches 1 \
  --deployment-branch-1 main \
  --model-reqeng mai-code-2 \
  --model-work claude-sonnet-5.5 \
  --model-review gpt-6.1-terra \
  --create-project \
  --project-title repository \
  --dry-run
```

For manual creation, verify `gh project create --help`, confirm the owner, then rerun the Companion with `--project-number <number>`. Do not blindly recreate after partial failure; see [Recovery](recovery.md).

## Upgrade

There is no `plugin update`. Reinstall the newer plugin:

```bash
squad plugin verify
squad plugin install /path/to/newer/squad-heroes
squad plugin verify
```

That replaces only the plugin distribution. Active Companion targets change only after a separate dry-run and apply of the newly installed Companion. `squad plugin uninstall squad-heroes` leaves active targets and `.squad/heroes.json`.

## Repair the Squad launcher

First run `squad upgrade --self` as the normal user. For `EACCES` or `EPERM` from a root-owned global npm package:

```bash
sudo sh -c 'umask 022 && exec npm install -g --allow-scripts=@bradygaster/squad-cli,node-pty,koffi,protobufjs @bradygaster/squad-cli@latest'
```

```bash
command -v squad
ls -l "$(command -v squad)"
squad --version
```

Then run `squad upgrade` in the consumer. Never run Squad under `sudo`, recursively `chmod`, or use `--dangerously-allow-all-scripts`.
