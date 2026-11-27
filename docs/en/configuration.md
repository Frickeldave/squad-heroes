# Configuration

## Companion state

`.squad/heroes.json` is the sole companion metadata file. Schema v1 contains
profile identity, branches, language, flow models, repository, ownership,
recovery and registered extensions. Unknown keys, models, extension values or
type errors stop fail-closed.

`recovery.targets` stores only SHA-256 baselines for the last confirmed managed
targets. An unchanged upstream state can update automatically, while local
drift remains a conflict until an explicit decision. Decisions remain in that
same recovery structure and never replace `.squad/plugins/*`.

The installed entry point loads this state from the consumer repository, not
from the original plugin checkout. On an interactive update it displays stored
values as labeled defaults. Repository, branches and language are collected
normally; the three default flow models use an arrow-key picker. CLI flags
remain authoritative. Review baseline and board configuration are validated
again.

## Models

Each flow's installation **default** is selected under `Default model for
reqeng`, `work` or `review`. Interactive input uses Up/Down or `j`/`k`, Enter,
and Escape/`q`; numeric entry is ignored. Discovery comes from
`copilot help config`, with a visibly announced verified fallback catalog if
unavailable. The installation flags are `--model-reqeng`, `--model-work` and
`--model-review`.
There is no `auto`, cache, family, team, prompt or cross-flow fallback. The model
is resolved once and passed unchanged.
Before launch, the Companion probes the ID with an isolated
`copilot config model` query against the authorized host catalog. Credential
values are neither read nor emitted. A launcher invocation can still use
`--model ID` to override that flow's configured default for this run.

## Prompt layers

Only paths from `.github/prompts/addon.config.json` load. Array order is binding.
Common layers, flow layers and explicit runtime context are additive; base
gates cannot be weakened. Symlinks, traversal, globs, invalid UTF-8 and files
over 256 KiB are rejected.

## Deployment branches

Exactly one, two or three names are valid. Non-interactive mode requires
`--deployment-branches 1|2|3` and the matching `--deployment-branch-N`
arguments. Names are neither normalized nor guessed. They render into
`heroes.json` and the five consumer workflows.

## Profile

| Role | Agent |
| --- | --- |
| Lead Architect | Tony |
| Requirement Engineer | Pepper |
| Backend Engineer | Bruce |
| Tester | Clint |
| Documentation | Maria |
| Frontend Engineer | Natasha |
| DevOps Specialist | Nick |

## Board sync

Board sync is enabled only with complete versioned extension configuration.
The repository owner is derived and cannot be guessed. If no explicit
`--project-number` or stored number exists, a read-only `gh project list` check
auto-selects one candidate, presents the same arrow-key picker for multiple candidates, or presents the explicit create/cancel menu for zero candidates. The selected project is
verified with `gh project view` before the plan. Explicit numbers must pass the
same check. Without opt-in, no workflow is installed, no secret is read and no
Project permission is requested. Invalid partial configuration stops.

## Zero-Project creation configuration

The product owner remains derived from the repository. Owner account type and GraphQL node ID are resolved, never guessed. `--create-project` is an approval-bearing flag, not a boolean; pair it with a safe explicit `--project-title` in CI. Invalid/generic, whitespace-padded, control-character, or overlong titles fail before planning. Existing one/multiple/explicit-number behavior is unchanged. The dry-run plan uses `{{PROJECT_NUMBER}}`; apply resolves and stores the actual number in `.squad/heroes.json`. Schema and repository-link operations are idempotent.
