# Installation

## Architecture

The Squad plugin owns the complete versioned distribution below
`.squad/templates/squad-heroes/companion/`. It contains the installer; static
source copies of the `src/` runtime, scripts, `.squad/heroes/` data, workflows,
templates, resources, localized Humanizer files, and package metadata. Squad
2.0 records and copies this distribution but never executes it.

The installed Companion owns the active consumer targets it materializes after
an explicit, separate invocation. Plugin verification/update/uninstall therefore
never owns, updates or removes those active targets.

## Preflight

The Companion requires one stable Squad marker `<!-- version: X.Y.Z -->` in
`.github/agents/squad.agent.md`, at least 2.0.0. It checks the marker before
planning and again before writing. Missing, duplicate, invalid, prerelease and
older markers stop with exit code 2.

The Companion checks `gh`, host authentication, the authenticated account, and
non-mutating repository read/push permissions at startup. It proves the
write-capable `project` scope from the active account's sanitized `gh auth
status --hostname github.com` scope line, then performs a non-mutating Project
API probe for the owner derived from the repository and caches that result.
All GitHub checks happen before profile, repository,
model, language, branch, review-baseline, or Project-choice menus. When the
repository is absent, only its unavoidable prompt follows authentication. This
The `project` scope and API probe are required for every full wizard/install and
dry-run flow, even if board sync is later left disabled. Metadata-only reads
can technically use `read:project`, but squad-heroes Board setup updates
Project fields/status/schema and therefore requires `project`. The Companion never requests, accepts or
persists a token. An unsupported
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

There are two plans. The first is the **plugin distribution plan**. The Squad
dry-run lists the complete versioned package, including
`templates/squad-heroes/companion/scripts/install`,
`templates/squad-heroes/companion/src/installer`, packaged script and workflow
sources, resources, and Humanizer files. Every target remains below
`templates/squad-heroes/companion/`; the plan does not directly target active
root `scripts/`, `.github/prompts/`, or `.github/workflows/`.

Invoke the copied entry point from the consumer:

```bash
node .squad/templates/squad-heroes/companion/scripts/install \
  --target "$PWD" \
  --dry-run
```

On a TTY, a wizard gathers the profile, repository, language and deployment
branch count/names. The three **default flow models** and multiple-Project
choices use an in-place arrow-key picker: Up/Down or `j`/`k` moves, Enter
confirms, and Escape/`q` cancels. Numeric entry is not accepted. Without a TTY,
the installer fails closed and instructs automation to provide the
noninteractive model/project flags. If model discovery fails, a visible
verified fallback list is used. The launcher runtime `--model` override remains
independent. The optional review baseline is clearly labeled and must resolve
to a commit in the target repository.

The first activation plan is rendered before any write. If it contains local
conflicts, each target is shown with its section and concise local/incoming
previews, followed by an arrow-key decision picker. Select `use`, `keep`,
`merge`, or `abort` and confirm with Enter. For a **fresh Squad 2.0 file with
no managed marker**, `merge` is clearly recommended because it inserts the
incoming managed section after all existing local bytes; do not assume that
recommendation for marker-bearing or otherwise ambiguous files. After the
choices, Companion rebuilds and renders the resolved plan. A dry-run then
finishes with `changed: 0`; apply writes only after this resolved plan is
approved. The exact decisions are stored in `.squad/heroes.json` for recovery.

Project board opt-in never asks for owner or number. Owner is always derived
from `--repository`; the available Projects are read through `gh`. One Project
is selected automatically, multiple Projects use the same arrow-key picker, and zero opens the explicit Companion-create, manual-create, and cancel menu. Manual selection and cancellation both print the recovery steps below. Explicit `--project-number` (and a
matching derived-owner `--project-owner`) may be used by CI but is always
validated through the API. Before Board configuration can mutate, a fresh
GraphQL check verifies `viewerCanUpdate`; the later workflow repeats that
check immediately before its first Project write. Dry-run performs only these
read checks. Empty
optional values use the displayed existing value. Non-interactive CI supplies:

```bash
node .squad/templates/squad-heroes/companion/scripts/install \
  --target "$PWD" --repository owner/repository \
  --profile typescript-development --language en \
  --deployment-branches 2 \
  --deployment-branch-1 main --deployment-branch-2 int \
  --model-reqeng mai-code-2 \
  --model-work claude-sonnet-5.5 \
  --model-review gpt-6.1-terra \
  --decisions .squad/heroes-decisions.json \
  --dry-run
```

CI supplies `--decisions` only when the first plan reports unresolved
conflicts. The file is a JSON object keyed by exact target paths, for example:

```json
{
  ".squad/team.md": "merge",
  ".squad/routing.md": "merge"
}
```

Values are exactly `use`, `keep`, `merge`, or `abort`. CI never receives a
TTY prompt and fails before local or Project writes when a required decision is
missing.

This is the **Companion activation plan**. It must separately include active
`scripts/start-work.mjs`, `.github/prompts/`, `.github/workflows/heroes-ci.yml`
and agent targets. Review it, then run the same copied command without
`--dry-run`. Only that explicit human run writes active files. A repeated
invocation is a no-op unless approved configuration or package content changed.

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

There is no supported `plugin update` command. Update the versioned distribution
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

## Companion-created Projects

With board sync enabled and zero visible Projects, the TTY wizard renders an arrow-key menu: create with Companion, create manually, or cancel/supply/share one. It derives owner `frickeldave-test`, proposes title `squad-heroes-snake`, and requires explicit title/owner confirmation. For CI, both `--create-project` and `--project-title` are mandatory; `--create-project=false` is invalid.

If manual or automatic provisioning fails, sign in to the active GitHub
account and create a user Project owned by `frickeldave-test` titled
`squad-heroes-snake`. In the GitHub UI: avatar → **Your projects** → **New
project**. Alternatively, after `gh project create --help` verifies this exact
syntax, run:

```bash
gh project create --owner frickeldave-test --title squad-heroes-snake
```

Grant the active account Project write access and verify it:

```bash
gh project list --owner frickeldave-test --limit 100 --format json
```

Rerun the copied Companion with `--project-number <number>`, or select it in a
TTY arrow menu. Dry-run cannot create the Project. After apply fails, the
Project may exist and its schema or repository link may be partial; inspect the
list/state before retrying, never copy secret values, and do not blindly create
again. `HEROES_PROJECT_TOKEN` needs only `project`; repository operations stay on
`github.token`.

Exact dry-run (no GitHub mutation):

```bash
node .squad/templates/squad-heroes/companion/scripts/install --target "$PWD" --repository frickeldave-test/squad-heroes-snake --enable-board-sync --profile typescript-development --language en --deployment-branches 1 --deployment-branch-1 main --model-reqeng mai-code-2 --model-work claude-sonnet-5.5 --model-review gpt-6.1-terra --create-project --project-title squad-heroes-snake --dry-run
```

The same command without `--dry-run` is apply. It uses authenticated `gh api graphql` to create after local conflict checks, resolves the real number/node ID, configures the status field/options, links the repository, validates `viewerCanUpdate`, and then writes `.squad/heroes.json`. The terminal apply additionally requires approval of the rendered plan. Manual cleanup may be necessary after a partial external failure; no automatic rollback is promised.
