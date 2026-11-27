# Konfiguration

## Companion-State

`.squad/heroes.json` ist die einzige Companion-Metadaten-Datei. Schema v1 enthält
Profilidentität, Branches, Sprache, Flow-Modelle, Repository, Ownership, Recovery
und registrierte Extensions. Unbekannte Schlüssel, Modelle, Extension-Werte oder
Typfehler stoppen fail-closed.

`recovery.targets` hält ausschließlich SHA-256-Baselines der zuletzt bestätigten
verwalteten Ziele. So wird ein unveränderter Upstream-Stand automatisch
aktualisierbar, während lokaler Drift bis zur expliziten Entscheidung als
Konflikt bleibt. Entscheidungen liegen in derselben Recovery-Struktur; sie
ersetzen niemals `.squad/plugins/*`.

Der installierte Einstiegspunkt liest diesen Stand aus dem Consumer, nicht aus
dem ursprünglichen Plugin-Checkout. Interaktive Updates zeigen Bestandswerte
als beschriftete Vorgaben. Die drei Standardmodelle werden mit einem
Pfeiltasten-Picker gewählt; CLI-Flags bleiben maßgeblich. Review-Baseline und
Board-Konfiguration werden erneut validiert.

## Modelle

Der Installations-**Standard** jedes Flows wird als `Standardmodell für reqeng`,
`work` oder `review` gewählt. Interaktiv bewegen Hoch/Runter oder `j`/`k`,
Enter bestätigt und Escape/`q` bricht ab; Zifferneingabe wird ignoriert. Die
Erkennung nutzt `copilot help config`. Ist sie nicht verfügbar, wird ein
verifiziertes Ersatzmenü sichtbar angekündigt. Die Installationsflags heißen
`--model-reqeng`, `--model-work` und
`--model-review`.
Es gibt keinen `auto`-, Cache-, Family-, Team-,
Prompt- oder Cross-Flow-Fallback. Das Modell wird einmal aufgelöst und unverändert
weitergegeben.
Vor dem Start prüft das Companion-Profil die ID mit einer isolierten
`copilot config model`-Abfrage gegen den autorisierten Host-Katalog. Credential-
Werte werden dabei weder gelesen noch ausgegeben. Per Launcher-Aufruf darf
`--model ID` weiterhin den konfigurierten Standard dieses Flows überschreiben.

## Prompt-Layer

Nur Pfade aus `.github/prompts/addon.config.json` werden geladen. Die Reihenfolge
ist bindend. Gemeinsame Layer, Flow-Layer und expliziter Laufkontext bleiben
additiv; Base-Gates dürfen nicht abgeschwächt werden. Symlinks, Traversal,
Globs, ungültiges UTF-8 und Dateien über 256 KiB sind unzulässig.

## Deployment-Branches

Erlaubt sind exakt ein, zwei oder drei Namen. Nicht-interaktiv sind
`--deployment-branches 1|2|3` und passend viele
`--deployment-branch-N`-Argumente Pflicht. Namen werden nicht normalisiert oder
geraten. Sie erscheinen in `heroes.json` und den fünf Consumer-Workflows.

## Profil

| Rolle | Agent |
| --- | --- |
| Lead Architekt | Tony |
| Requirement Engineer | Pepper |
| Backend Engineer | Bruce |
| Tester | Clint |
| Dokumentation | Maria |
| Frontend Engineer | Natasha |
| DevOps Specialist | Nick |

## Board-Sync

Board-Sync ist nur mit kompletter, versionierter Extension-Konfiguration
aktivierbar. Der Repository-Owner wird abgeleitet und nie geraten. Fehlen
`--project-number` und gespeicherte Nummer, wählt eine lesende
`gh project list`-Prüfung einen einzelnen Kandidaten automatisch, zeigt bei
mehreren denselben Pfeiltasten-Picker und stoppt bei null mit menschlicher
Einrichtungsanleitung.
Das gewählte Project wird vor dem Plan mit `gh project view` verifiziert; eine
explizite Nummer passiert denselben Check. Ohne Opt-in wird weder Workflow
installiert noch ein Secret gelesen oder eine Project-Permission angefordert.
Fehlerhafte Teilkonfiguration stoppt.

## Konfiguration bei null Projects

Der Product-Owner bleibt aus dem Repository abgeleitet. Account-Typ und GraphQL-Node-ID werden aufgelöst, nie geraten. `--create-project` ist ein Freigabe-Flag ohne Boolean-Wert und wird in CI mit einem sicheren, expliziten `--project-title` kombiniert. Generische, leer/Whitespace-gepolsterte, control- oder überlange Titel scheitern vor dem Plan. Ein-/Mehrfach-/Explizitnummer-Flows bleiben unverändert. Der Dry-run nutzt `{{PROJECT_NUMBER}}`; Apply speichert die echte Nummer. Schema- und Repository-Link sind idempotent.
