# SupplierPulse reference matrix

The local reference tree was read only. The product neither imports it at
runtime/build/install nor contains reference paths. "Reproduce generically"
means abstracting behavior, not copying 1:1.

| Source | Target | Decision | Generic reproduction | Overrides/adapters | Evidence |
| --- | --- | --- | --- | --- | --- |
| `.github/prompts/BLUEPRINT.md` | Prompt/layer templates | reproduce generically | fixed prompt composition and hard gates | local layers | resolver test |
| `.github/prompts/startreqeng.prompt.md` | `startreqeng.*.md` | reproduce generically | bundled questions, no guessing | owner/labels | ReqEng tests |
| `.github/prompts/startwork.prompt.md` | `startwork.*.md` | reproduce generically | preflight and conflict-safe plan | build/test rules | installer test |
| `.github/prompts/startreview.prompt.md` | `startreview.*.md` | reproduce generically | baseline precedence | review commands | resolver contract |
| `scripts/flow-shared.mjs` | `heroes-flow-shared.mjs` | reproduce generically | auth/model/spawn gates | repository/models | installer/plan tests |
| `scripts/start-flow-options.mjs` | installer + launchers | reproduce generically | flags and fail-closed parsing | profile | argument tests |
| `scripts/start-reqeng.mjs` | `start-reqeng.mjs` | reproduce generically | one model resolution and prompt composition | issue context | static test |
| `scripts/start-work.mjs` | `start-work.mjs` | reproduce generically | auth, model and unchanged handoff | worktree/runtime | static test |
| `scripts/start-review.mjs` | `start-review.mjs` | reproduce generically | explicit/configured baseline | PR adapter | static test |
| `scripts/status-sync.mjs` | `sync-project-board.mjs` | reproduce generically | idempotent item/status sync | owner/project/mapping | workflow tests |
| `scripts/*flow*.test.mjs` | `test/*` | reproduce generically | negative and idempotency tests | — | `npm test` |
| `scripts/*status*.test.mjs` | `test/product.test.mjs` | reproduce generically | opt-in and ownership boundaries | — | `npm test` |
| `.github/workflows/sp-ci.yml` | `heroes-ci.yml` | reproduce generically | checkout/Node/npm/tests | branches/commands | workflow template |
| `.github/workflows/sp-status-sync.yml` | `heroes-sync-project-board.yml` | reproduce generically | events, least privilege, dry run | Project mapping | workflow template |
| `.github/workflows/squad-*.yml` | `heroes-configure.yml` | reproduce generically | roster and labels | Project opt-in | workflow template |
| `.squad/team.md` | team marker block | reproduce generically | roles/casts | local members | merge test |
| `.squad/routing.md` | routing marker block | reproduce generically | deterministic routes | local routing | plan test |
| `.github/skills/git-workflow/SKILL.md` | `squad-heroes-flow-safety` | reproduce generically | static skill manifest | profile | manifest test |
| SupplierPulse deploy/infra/DB | — | exclude | product/environment-specific | local layers | blocked in distribution |
| SupplierPulse names/URLs | — | exclude | no generic defaults | consumer config | negative test |
| SupplierPulse secrets/runners/tenants | — | exclude | no credentials/runner assumptions | secret name only with opt-in | negative test |
| CRAFT badge mechanism | `update-badges.mjs` + workflow | reproduce generically | marker block, check, no-op, stale head | sources/README | badge test |
| CRAFT release gate | version/gate/hook/template | reproduce generically | label + semver + merge base | tag line/labels | workflow/source test |
| CRAFT configure | `heroes-configure.yml` | reproduce generically | labels and Project validation | owner/project | workflow template |

Targets have no import, runtime or distribution dependency on the reference
path; `test/product.test.mjs` enforces that boundary.
