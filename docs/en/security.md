# Security and ownership

## Write boundaries

- Squad owns only `.squad/plugins/*`.
- The plugin owns the distribution below `.squad/templates/squad-heroes/companion/`.
- The Companion owns only explicitly cataloged active targets.
- Profile sources belong under `.squad/001/`; active agents are materialized under `.squad/agents/`.
- Prompt layers come only from `.github/prompts/addon.config.json`.

Plugin commands do not change active Companion files. The Companion does not change its plugin bundle. No file has two concurrent owners.

## Approval

Planning requires host authentication, account, repository access, and a non-mutating Project API probe. The writable `project` scope is read from sanitized output; only safe scope/permission booleans are retained.

Dry-run and initial activation do not write a Project. Board mutation requires opt-in and a fresh `viewerCanUpdate` check. Project creation requires plan approval, `--create-project` in CI, and an additional `y/N` in interactive mode.

## Conflicts

Active conflicts show base, local, incoming, and result. Only `use`, `keep`, `merge`, and `abort` are valid. Merge is revalidated; `history.md` remains append-only. Unresolved conflicts stop before writes.

## Credentials

Tokens and PATs are not requested or accepted as arguments, stdin, fixtures, files, or logs. Supported input is limited to the host credential store and official browser/device flows. `--with-token`, token environment values, and printed headers are prohibited.

Project workflows require the fixed `secrets.HEROES_PROJECT_TOKEN` expression because `github.token` cannot receive GitHub Projects v2 owner access. The PAT needs only `project` or fine-grained Projects read/write; it does not need `repo`. Repository issue/PR access stays on `${{ github.token }}`. No token value is read, stored in `.squad/heroes.json`, or logged.

## Project creation

Apply creates a Project only after local conflict checks. It resolves the real number, checks `viewerCanUpdate`, configures schema/link, and stores the number. Partial failure may leave external state; no global rollback is claimed. Recovery inspects visible Project state rather than blindly retrying.

## Supply chain

Trust level: `source trust: moderate`. The version, release/commit, and available hashes are checked. The product does not claim its own PKI, certificate, or signature infrastructure.
