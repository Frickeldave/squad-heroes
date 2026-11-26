# Akzeptanzmatrix

| Kriterien | Status | Umsetzung und Nachweis |
| --- | --- | --- |
| 1–8 Versionsgate | umgesetzt | `src/preflight.mjs`, `plugin-preflight.mjs`, zweiter Check in `applyPlan`, Negativtests inkl. zweiter Check |
| 9–13 Plugin | umgesetzt | `plugin.manifest.json`, statische `.squad/`-Quellen, echter `squad plugin` Lifecycle-Test |
| 14–17 Companion/Conflicts/Board | umgesetzt | `scripts/install.mjs`, markerbasierter 3-Way-Plan, append-only History, opt-in Project-Workflow |
| 18–20 Flows/Overrides | umgesetzt | drei Launcher, Resolver, `addon.config.json`, fünf Workflow-Vorlagen |
| 21–23 Tests/Validierungsziele | umgesetzt | Node-Tests, Lifecycle-Smoke, neutrale Fixture, read-only Referenzmatrix |
| 24–33 Prompt-Layer | umgesetzt | exakte Prompt-Namen, explizite Layer-Liste, UTF-8/Pfad/Größen-Gates, Baseline-Regel |
| 34–42 ReqEng/Ralph | umgesetzt | bilingualer Promptvertrag, idempotenter Markerblock und Antwortparser |
| 43–46 Referenzvergleich | umgesetzt | vollständige `referenzmatrix.md`, Verbotstests gegen Projektwerte/Runtime-Referenz |
| 47–51 Identität/Auth/Doku | umgesetzt | konsistente Identity, `gh`-Gates, Kapitel-parallele DE/EN-Doku |
| 52–60 Profile/Agenten | umgesetzt | geschlossenes TypeScript-Profil, 14 Sprachquellen, Charter-/History-/Team-Marker |
| 61–66 Lokalisierung | umgesetzt | DE/EN Agenten/Prompts, JSON-Nachrichten, Schlüssel-/Platzhalter-/Paritätstests |
| 67–76 Vertrauen/State/Modelle/Recovery | umgesetzt | moderate Trust-Vertrag, geschlossenes `heroes.json`, unveränderliches Profil und idempotente Pläne |
| 77–81 Skills | umgesetzt | checksummiertes Manifest, statische Plugin-Quelle, Companion-Ziel, Konfliktplan |
| 82–87 Modellwahl | umgesetzt | drei exakte Flow-Defaults, `--model`-Priorität, kein `auto`/Fallback, unveränderte Spawn-Übergabe |
| 88–90 Badges | umgesetzt | eindeutiger Markerblock, `--check`, no-op, Bot/Skip/Stale-Head-Workflow |
| 91–94 Version/Release | umgesetzt | strikte Version, Workspace-Abgleich, Merge-Base/Release-Gate, read-only Workflow |
| 95–99 Branch-Strategie | umgesetzt | 1/2/3-Flags, Ref-Validierung, Rendern, No-op- und Konflikttests |
| 100–107 Consumer-Workflows | umgesetzt | getrennte configure/release/badge/CI-Vorlagen mit Minimalpermissions |
| 108–118 Board-Addon | umgesetzt | vollständiges Opt-in-Schema, getrennte Events, Dry-run, Idempotenz, fehlende Defaults |
| Remote Publishing/PKI | nicht anwendbar | nicht versprochen; Release-Einheit ist Tag/Version/Checksum |
| Echte Consumer-Board-Daten | konfigurationsabhängig | werden pro Zielrepository explizit übergeben; kein CRAFT-Default und kein User-Entscheidungsblocker |

Status „umgesetzt“ gilt für den generischen Produktvertrag. Consumer-spezifische
Werte bleiben bewusst Laufzeitkonfiguration, nicht erfundene Projektzustände.
