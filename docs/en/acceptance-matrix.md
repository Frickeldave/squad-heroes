# Acceptance matrix

| Criteria | Status | Implementation and evidence |
| --- | --- | --- |
| 1–8 version gate | implemented | `src/preflight.mjs`, plugin preflight, second check in `applyPlan`, full negative matrix and TOCTOU test |
| 9–13 plugin | implemented | `plugin.manifest.json`, static `.squad/` sources, real `squad plugin` lifecycle test |
| 14–17 companion/conflicts/board | implemented | installer, marker 3-way plan, append-only history, opt-in Project workflow |
| 18–20 flows/overrides | implemented | three launchers, resolver, `addon.config.json`, five workflow templates |
| 21–23 tests/validation targets | implemented | Node tests, lifecycle smoke, neutral fixtures, read-only reference matrix |
| 24–33 prompt layers | implemented | canonical prompt names, explicit layers, UTF-8/path/size gates, baseline rule |
| 34–42 ReqEng/Ralph | implemented | bilingual prompt contract, idempotent marker block and answer parser |
| 43–46 reference comparison | implemented | complete reference matrix and negative source/runtime-reference tests |
| 47–51 identity/auth/docs | implemented | consistent identity, `gh` gates and parallel DE/EN chapters |
| 52–60 profiles/agents | implemented | closed TypeScript profile, 14 language sources, charter/history/team markers |
| 61–66 localization | implemented | DE/EN agents/prompts, JSON messages, key/placeholder/parity tests |
| 67–76 trust/state/models/recovery | implemented | moderate trust, closed `heroes.json`, immutable profile, idempotent plans |
| 77–81 skills | implemented | checksummed manifest, static plugin source, companion target and conflict plan |
| 82–87 model selection | implemented | exact flow defaults, `--model` precedence, no auto/fallback, unchanged handoff |
| 88–90 badges | implemented | one marker block, `--check`, no-op and bot/skip/stale-head workflow |
| 91–94 version/release | implemented | strict version, workspace check, merge-base/release gate and read-only workflow |
| 95–99 branch strategy | implemented | 1/2/3 flags, ref validation, render, no-op and conflict tests |
| 100–107 consumer workflows | implemented | separate configure/release/badge/CI templates with least privilege |
| 108–118 board addon | implemented | complete opt-in schema, separate events, dry run, idempotency and no defaults |
| Remote publishing/PKI | not applicable | explicitly out of scope; release identity is tag/version/checksum |
| Real consumer board data | configuration-dependent | explicitly supplied per target repository; no CRAFT default or user-decision blocker |

"Implemented" covers the generic product contract. Consumer-specific values stay
runtime configuration rather than invented project state.
