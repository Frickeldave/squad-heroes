# Konfiguration

## State

`.squad/heroes.json` ist die einzige Companion-Metadaten-Datei. Schema v1 enthält den unveränderlichen Profilwert `001`, Repository, Branches, Sprache, Flow-Modelle, Ownership, Extensions und Recovery. Unbekannte Schlüssel, Werte oder Typfehler stoppen fail-closed. Ein vorhandener Wert `typescript-development` wird beim nächsten Plan einmalig zu `001` migriert.

`recovery.targets` speichert SHA-256-Baselines und bestätigte Entscheidungen der aktiven Ziele. Diese Daten ersetzen nie `.squad/plugins/*`. Der Installer liest den State im Consumer; bei Updates erscheinen Bestandswerte sichtbar als Vorgaben.

## Profile

Die Menüanzeige für Profil 001 ist exakt `001 Typescript developer project`. Die versionierte lokale Quelle liegt unter `.squad/001/`; aktive Agenten liegen unter `.squad/agents/`.

| Rolle | Agent |
| --- | --- |
| Lead Architekt | Tony |
| Requirement Engineer | Pepper |
| Backend Engineer | Bruce |
| Tester | Clint |
| Dokumentation | Maria |
| Frontend Engineer | Natasha |
| DevOps Specialist | Nick |

Agenten, Skills und typabhängige Overrides kommen aus 001. Die drei Flows bleiben gemeinsam und werden nicht unter `.squad/001/` dupliziert.

## Modelle

Installation und Defaults nutzen `--model-reqeng`, `--model-work` und `--model-review`. Interaktive Auswahl akzeptiert Pfeile oder `j`/`k`; Enter bestätigt, Escape/`q` bricht ab. Ziffern wählen nicht.

Der Companion löst jedes Modell gegen den autorisierten Katalog auf und übergibt die ID unverändert. Es gibt keinen Cache-, Family-, Team-, Prompt- oder Cross-Flow-Fallback. `--model ID` überschreibt nur den aktuellen Launcher-Lauf. Discovery nutzt `copilot help config`; bei Fehler wird eine gekennzeichnete, verifizierte Ersatzliste angezeigt.

## Deployment-Branches

Erlaubt sind exakt ein bis drei Namen. Nicht-interaktiv gehören `--deployment-branches 1|2|3` und passend viele `--deployment-branch-N`-Argumente zusammen. Namen werden weder normalisiert noch geraten und erscheinen in State und fünf Workflows.

## Prompt-Layer

Nur Pfade aus `.github/prompts/addon.config.json` werden geladen. Ihre Reihenfolge und additive Kombination sind bindend; Basis-Gates dürfen nicht abgeschwächt werden. Symlinks, Traversal, Globs, ungültiges UTF-8 und Dateien über 256 KiB werden abgelehnt.

## Board-Sync

Board-Sync benötigt vollständige Extension-Konfiguration. Der Owner wird aus dem Repository abgeleitet. Ein Project wird automatisch gewählt, mehrere über den Picker und null über Companion-Anlage, manuelle Anlage oder Abbruch. Das Project wird vor Planung und vor Mutation mit `viewerCanUpdate` geprüft. Explizite `--project-number`-Overrides bestehen dieselben Gates.

`--create-project` ist ein Freigabeflag ohne Boolean und benötigt in CI einen konkreten `--project-title`. Dry-run nutzt `PLANNED_CREATE` mit `{{PROJECT_NUMBER}}`; Apply erstellt einmal, löst die reale Nummer auf, konfiguriert Schema und Link idempotent und speichert sie.

Project-Workflows verwenden fest `HEROES_PROJECT_TOKEN`. Für Project v2 reicht ein klassischer PAT mit nur `project` oder ein fein abgestufter PAT mit Projects-Lese-/Schreibrecht. Repository-Issue-/PR-Zugriffe bleiben bei `${{ github.token }}`. Der Installer rendert nur den festen Secret-Ausdruck und speichert oder protokolliert keinen Tokenwert.
