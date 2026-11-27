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

Before mutation, `gh auth status` and push permission are required. Every
irreversible or externally visible effect must also be explicitly approved in
the plan. Permission does not replace approval. This MVP installer performs no
real board, release or deployment writes.

## Conflicts

Existing managed areas show base, local, incoming and result. Allowed decisions
are only `use`, `keep`, `merge` and `abort`. A merge is revalidated.
`history.md` stays append-only; `team.md` changes marker sections only.

## Credentials

Tokens and PATs are never requested or accepted as arguments, stdin, files,
logs or test fixtures. Only the host credential store and official
browser/device flow are supported.
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
