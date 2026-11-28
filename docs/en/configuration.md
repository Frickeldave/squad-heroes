# Configuration

## State

`.squad/heroes.json` is the sole Companion metadata file. Schema v1 contains the immutable profile value `001`, repository, branches, language, flow models, ownership, extensions, and recovery data. Unknown keys, values, or types fail closed. An existing `typescript-development` value migrates once to `001` on the next plan.

`recovery.targets` stores SHA-256 baselines and confirmed decisions for active targets. It never replaces `.squad/plugins/*`. The installer reads state in the consumer repository; updates show existing values as labeled defaults.

## Profiles

Profile 001 is displayed exactly as `001 Typescript developer project`. Its versioned local source is under `.squad/001/`; active agents are under `.squad/agents/`.

| Role | Agent |
| --- | --- |
| Lead architect | Tony |
| Requirement engineer | Pepper |
| Backend engineer | Bruce |
| Tester | Clint |
| Documentation | Maria |
| Frontend engineer | Natasha |
| DevOps specialist | Nick |

Agents, skills, and type-specific overrides come from 001. The three flows remain shared and are not duplicated below `.squad/001/`.

## Models

Installation and defaults use `--model-reqeng`, `--model-work`, and `--model-review`. Interactive selection accepts arrows or `j`/`k`; Enter confirms and Escape/`q` cancels. Numbers do not select.

The Companion resolves each model against the authorized catalog and passes the ID unchanged. There is no cache, family, team, prompt, or cross-flow fallback. `--model ID` overrides only the current launcher run. Discovery uses `copilot help config`; if it fails, the installer shows a labeled, verified fallback list.

## Deployment branches

Exactly one to three names are valid. Noninteractive mode requires `--deployment-branches 1|2|3` and the matching `--deployment-branch-N` arguments. Names are not normalized or guessed and render into state and five workflows.

## Prompt layers

Only paths listed in `.github/prompts/addon.config.json` load. Their order and additive combination are binding; base gates cannot be weakened. Symlinks, traversal, globs, invalid UTF-8, and files over 256 KiB are rejected.

## Board sync

Board sync requires complete extension configuration. The owner derives from the repository. One Project is selected automatically, multiple Projects use the picker, and zero Projects offer Companion creation, manual creation, or cancellation. The Project is checked for `viewerCanUpdate` before planning and mutation. Explicit `--project-number` overrides pass the same checks.

`--create-project` is an approval flag, not a boolean, and CI must provide a concrete `--project-title`. Dry-run uses `PLANNED_CREATE` and `{{PROJECT_NUMBER}}`; apply creates once, resolves the real number, idempotently configures schema and repository link, and stores the number.

Project workflows use the fixed `HEROES_PROJECT_TOKEN` expression. Project v2 accepts a classic PAT with only `project` or a fine-grained PAT with Projects read/write. Repository issue/PR access uses `${{ github.token }}`. The installer renders only the fixed expression and stores or logs no token value.
