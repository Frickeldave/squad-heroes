# Installation

## Architecture

The Squad plugin owns only a versioned, static distribution below
`.squad/templates/squad-heroes/companion/`. It contains the installer, extensionless
ESM runtime modules, package metadata, templates, profiles, agents, localized
Humanizer resources, messages, active-target catalog, scripts and workflows.
Squad 2.0 records and copies this distribution but never executes it.

The installed Companion owns the active consumer targets it materializes after
an explicit, separate invocation. Plugin verification/update/uninstall therefore
never owns, updates or removes those active targets.

## Preflight

The Companion requires one stable Squad marker `<!-- version: X.Y.Z -->` in
`.github/agents/squad.agent.md`, at least 2.0.0. It checks the marker before
planning and again before writing. Missing, duplicate, invalid, prerelease and
older markers stop with exit code 2.

The Companion also requires successful `gh auth status` and a non-mutating push
permission query. It never requests, accepts or persists a token. An unsupported
Squad version must be repaired with the normal-user upgrade flow described
below; never run Squad itself with `sudo`.

## First installation

From the consumer repository, obtain the plugin source only to install it:

```bash
git clone https://github.com/Frickeldave/squad-heroes.git /path/to/squad-heroes
squad plugin validate /path/to/squad-heroes
squad plugin dry-run /path/to/squad-heroes
squad plugin install /path/to/squad-heroes
squad plugin enable squad-heroes
squad plugin verify
```

The Squad dry-run lists the complete static package, including
`templates/squad-heroes/companion/scripts/install`,
`templates/squad-heroes/companion/src/installer` and packaged workflow/script
sources. It must not list direct active consumer paths.

Invoke the copied entry point from the consumer:

```bash
node .squad/templates/squad-heroes/companion/scripts/install \
  --target "$PWD" \
  --dry-run
```

On a TTY, a wizard gathers the profile, repository, language, deployment branch
count/names, review baseline, all three explicit flow models and optional Project
board synchronization. Empty optional values use the displayed existing/default
value. Non-interactive CI supplies the existing flags:

```bash
node .squad/templates/squad-heroes/companion/scripts/install \
  --target "$PWD" --repository owner/repository \
  --profile typescript-development --language en \
  --deployment-branches 2 \
  --deployment-branch-1 main --deployment-branch-2 int \
  --model-reqeng mai-code-2 \
  --model-work claude-sonnet-5.5 \
  --model-review gpt-6.1-terra \
  --dry-run
```

The Companion dry-run must include `scripts/start-work.mjs`,
`.github/workflows/heroes-ci.yml` and active agent charters. Review it, then run
the same copied command without `--dry-run`. A repeated invocation is a no-op
unless approved configuration or package content changed.

## Repairing a root-owned global Squad installation

Run `squad upgrade --self` first as the normal user. If a root-owned npm package
fails with `EACCES` or `EPERM`, repair only the global npm package with:

```bash
sudo sh -c 'umask 022 && exec npm install -g --allow-scripts=@bradygaster/squad-cli,node-pty,koffi,protobufjs @bradygaster/squad-cli@latest'
```

Restart the terminal and verify:

```bash
command -v squad
ls -l "$(command -v squad)"
squad --version
```

Do not use `sudo squad`, recursive `chmod`, or
`--dangerously-allow-all-scripts`. After the launcher succeeds, run
`squad upgrade` in the consumer and verify its marker.

## Upgrade

There is no supported `plugin update` command. Update the static distribution
by installing a newer checkout:

```bash
squad plugin verify &&
squad plugin install /path/to/newer/squad-heroes &&
squad plugin verify
```

This replaces only plugin-owned distribution files. Existing active Companion
targets do not change. Review and explicitly apply those changes by rerunning
the newly installed local copy:

```bash
node .squad/templates/squad-heroes/companion/scripts/install --target "$PWD" --dry-run
node .squad/templates/squad-heroes/companion/scripts/install --target "$PWD"
```

The installed copy is self-contained; the external source checkout is not used
by Companion installation. `squad plugin uninstall squad-heroes` removes only
the managed distribution, not active files already created by the Companion.
