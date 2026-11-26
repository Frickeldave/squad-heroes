# Konfiguration

## Companion-State

`.squad/heroes.json` ist die einzige Companion-Metadaten-Datei. Schema v1 enthält
Profilidentität, Branches, Sprache, Flow-Modelle, Repository, Ownership, Recovery
und registrierte Extensions. Unbekannte Schlüssel, Modelle, Extension-Werte oder
Typfehler stoppen fail-closed.

## Modelle

Je Flow gilt ausschließlich `--model ID` > zugehöriger Wert in
`modelDefaults` > Abbruch. Es gibt keinen `auto`-, Cache-, Family-, Team-,
Prompt- oder Cross-Flow-Fallback. Das Modell wird einmal aufgelöst und unverändert
weitergegeben.

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
aktivierbar. Ohne Opt-in wird weder Workflow installiert noch ein Secret gelesen
oder eine Project-Permission angefordert. Fehlerhafte Teilkonfiguration stoppt.
