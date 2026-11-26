# Configuration

## Companion state

`.squad/heroes.json` is the sole companion metadata file. Schema v1 contains
profile identity, branches, language, flow models, repository, ownership,
recovery and registered extensions. Unknown keys, models, extension values or
type errors stop fail-closed.

## Models

Each flow uses only `--model ID` > its matching `modelDefaults` value > stop.
There is no `auto`, cache, family, team, prompt or cross-flow fallback. The model
is resolved once and passed unchanged.

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
Without opt-in, no workflow is installed, no secret is read and no Project
permission is requested. Invalid partial configuration stops.
