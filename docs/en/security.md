# Security and ownership

## Write boundaries

- Plugin lifecycle: only `.squad/plugins/*`, managed by Squad.
- Plugin content: the complete versioned distribution below
  `.squad/templates/squad-heroes/companion/`, including static copies of
  installer, runtime, scripts, `.squad/heroes/`, workflows, resources, and
  Humanizer files.
- Companion: explicitly cataloged active consumer targets in its separate
  activation plan.
- Prompt layers: only `.github/prompts/addon.config.json`.

The same target is never owned concurrently. The plugin distribution plan
does not directly target root `scripts/`, `.github/prompts/`, or
`.github/workflows/`. Plugin lifecycle commands do not change active Companion
files. The Companion is resolved from the installed distribution and never
changes its own plugin-managed bundle.

## Permissions and approval

Before planning, `gh auth status --hostname github.com`, authenticated account
access and `gh api repos/OWNER/REPO --jq .permissions` are required. The active
account's scope line must grant the write-capable `project` scope; only a
sanitized scope status is retained. Only the
read/push/admin/triage booleans are retained. Every full install, including
dry-run, additionally requires non-mutating Project API access; selected owner
is derived from the repository. Host failures direct the operator to
`gh auth login --hostname github.com --web`. Missing `project` scope remediation
is exactly `gh auth refresh -h github.com -s project`, followed by
`gh auth status --hostname github.com`. `read:project` is technically enough
only for isolated metadata reads, not this Board setup, which updates Project
fields/status/schema.
Permission does not replace explicit approval. The installer performs no
Project write in dry-run or initial activation; the later workflow remains a
separate opt-in.

## Conflicts

Existing managed areas show base, local, incoming and result. Allowed decisions
are only `use`, `keep`, `merge` and `abort`. A merge is revalidated.
`history.md` stays append-only; `team.md` changes marker sections only.

## Credentials

Tokens and PATs are never requested or accepted as arguments, stdin, files,
logs or test fixtures. Only the host credential store and official browser/device flow are supported.
The installer never uses `--with-token`, environment-token input, token
arguments or printed credentials.
The installed Project workflows are the one deliberate exception to using the
repository-scoped Actions `GITHUB_TOKEN`: Projects v2 are owned by a user or
organization, and GitHub does not expose a workflow permission that grants the
necessary Project V2 access to `GITHUB_TOKEN`. These workflows therefore use
the fixed Actions secret `HEROES_PROJECT_TOKEN`, containing either a classic PAT
with only the `project` scope or a fine-grained PAT with **Projects: Read and
write** for the Project owner. It does not need `repo`. Runtime scripts route
Project v2 calls through that secret while all repository issue/PR reads and
label writes use `${{ github.token }}` under the workflow's declared
permissions. No token value is read by the installer; only the fixed expression
is rendered, and neither expression nor value is persisted in
`.squad/heroes.json` or logged.
For an unsupported Squad version, the documented operator-only remedy is
`squad upgrade --self` as the normal user followed by `squad upgrade` in the
target repository. A root-owned global npm package may require the one-off
allowlisted repair in the installation guide; `sudo` is scoped to that npm
installation command and must not be used to run Squad. None of these commands
requires pasting a token into the terminal.

## Supply-chain verification

Trust is `source trust: moderate`: release/tag, version/commit and available
upstream hashes are checked. The product creates no custom PKI, certificate or
signature infrastructure and invents no upstream guarantee.

## Project creation approval boundary

Creation occurs only in apply, after all local plan conflict checks and a rendered create/schema/link plan. `--create-project` is explicit CI approval; interactive apply requires a further y/N confirmation after rendering. Dry-run enters `PLANNED_CREATE`: it performs identity, owner capability, scope, and non-mutating list probes, marks deferred schema/link operations, and never looks up `{{PROJECT_NUMBER}}`. Apply enters `APPLY_CREATE`, creates once, immediately resolves the returned number through the visible Project and GraphQL APIs, checks `viewerCanUpdate`, then configures and links idempotently. Actionable 403/404 guidance applies to existing selection and post-create verification. No token argument is accepted or logged. Mutation is not retried blindly. Cleanup is manual and no rollback is claimed.
