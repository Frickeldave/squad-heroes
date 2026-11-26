# SupplierPulse-Referenzmatrix

Der lokale Referenzbaum wurde ausschließlich gelesen. Das Produkt importiert ihn
weder zur Laufzeit noch beim Build/Install und enthält keine Referenzpfade.
„Generisch nachbilden“ beschreibt ein abstrahiertes Verhalten, keine 1:1-Kopie.

| Source | Target | Entscheidung | Generische Nachbildung | Overrides/Adapter | Beleg |
| --- | --- | --- | --- | --- | --- |
| `.github/prompts/BLUEPRINT.md` | Prompt-/Layer-Vorlagen | generisch nachbilden | fester Promptaufbau und Harte Gates | lokale Layer | Resolver-Test |
| `.github/prompts/startreqeng.prompt.md` | `startreqeng.*.md` | generisch nachbilden | gebündelte Fragen, kein Raten | Owner/Labels | ReqEng-Tests |
| `.github/prompts/startwork.prompt.md` | `startwork.*.md` | generisch nachbilden | Preflight und konfliktgeschützter Plan | Build/Test-Regeln | Installer-Test |
| `.github/prompts/startreview.prompt.md` | `startreview.*.md` | generisch nachbilden | Baseline-Precedence | Review-Kommandos | Resolver-Vertrag |
| `scripts/flow-shared.mjs` | `heroes-flow-shared.mjs` | generisch nachbilden | Auth-, Modell- und Spawn-Gates | Repository/Modelle | Installer-/Plan-Tests |
| `scripts/start-flow-options.mjs` | `installer.mjs` + Launcher | generisch nachbilden | Flags und fail-closed Parsing | Projektprofil | Argumenttests |
| `scripts/start-reqeng.mjs` | `start-reqeng.mjs` | generisch nachbilden | eine Modellauflösung und Prompt-Komposition | Issue-Kontext | statischer Test |
| `scripts/start-work.mjs` | `start-work.mjs` | generisch nachbilden | Auth, Modell, unveränderte Übergabe | Worktree/Runtime | statischer Test |
| `scripts/start-review.mjs` | `start-review.mjs` | generisch nachbilden | explizite/configurierte Baseline | PR-Adapter | statischer Test |
| `scripts/status-sync.mjs` | `sync-project-board.mjs` | generisch nachbilden | idempotente Item-/Status-Synchronisation | Owner/Project/Mapping | Workflow-Tests |
| `scripts/*flow*.test.mjs` | `test/*` | generisch nachbilden | Negativ- und Idempotenztests | — | `npm test` |
| `scripts/*status*.test.mjs` | `test/product.test.mjs` | generisch nachbilden | Opt-in- und Ownership-Grenzen | — | `npm test` |
| `.github/workflows/sp-ci.yml` | `heroes-ci.yml` | generisch nachbilden | Checkout/Node/npm/Tests | Branches/Kommandos | Workflow-Vorlage |
| `.github/workflows/sp-status-sync.yml` | `heroes-sync-project-board.yml` | generisch nachbilden | Events, Minimalpermission, Dry-run | Project-Mapping | Workflow-Vorlage |
| `.github/workflows/squad-*.yml` | `heroes-configure.yml` | generisch nachbilden | Roster und Labels | Project-Opt-in | Workflow-Vorlage |
| `.squad/team.md` | `team.md`-Markerblock | generisch nachbilden | Rollen/Casts | lokale Mitglieder | Merge-Test |
| `.squad/routing.md` | `routing.md`-Markerblock | generisch nachbilden | deterministische Routen | lokales Routing | Plan-Test |
| `.github/skills/git-workflow/SKILL.md` | `squad-heroes-flow-safety` | generisch nachbilden | statisches Skill-Manifest | Profil | Manifest-Test |
| SupplierPulse Deploy/Infra/DB | — | ausschließen | produkt- oder umgebungsspezifisch | lokale Layer | Verboten in Distributionsquelle |
| SupplierPulse Produktnamen/URLs | — | ausschließen | keine generischen Defaults | Consumer-Config | Verbotstest |
| SupplierPulse Secrets/Runner/Tenants | — | ausschließen | keine Credentials oder Runnerannahmen | Secret-Name nur opt-in | Verbotstest |
| CRAFT Badge-Mechanik | `update-badges.mjs` + Workflow | generisch nachbilden | Markerblock, Check, no-op, stale head | Quellen/README | Badge-Test |
| CRAFT Release-Gate | Version/Gate/Hook/Vorlage | generisch nachbilden | Label+SemVer+Merge-Base | Tag-Linie/Labels | Workflow/Quelltest |
| CRAFT Configure | `heroes-configure.yml` | generisch nachbilden | Labels und Projektvalidierung | Owner/Project | Workflow-Vorlage |

Die entsprechenden Zielartefakte haben keine Import-, Laufzeit- oder
Distributionsabhängigkeit vom Referenzpfad; `test/product.test.mjs` testet diese
Grenze.
