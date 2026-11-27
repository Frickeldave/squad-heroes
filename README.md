# squad-heroes

Ein marketplace-fähiges Squad-Overlay und ein separat versionierter, lokal
ausgeführter Companion für TypeScript-Projekte.

<!-- BEGIN GENERATED BADGES -->
[![Version](https://img.shields.io/badge/version-0.1.0-blue)](package.json)
<!-- END GENERATED BADGES -->

## Übersicht

Der Squad-Plugin-Lifecycle verwaltet die vollständige statische, versionierte
Distribution. Diese liegt unter:

```text
.squad/templates/squad-heroes/companion/
```

`squad plugin install` kopiert diesen vollständigen Companion in das
Consumer-Repository. Dazu gehören Installer und statische Quellen des
Laufzeitcodes unter `src/` sowie von `scripts/`, `.squad/heroes/`, Workflows,
Templates, Ressourcen und Humanizer-Dateien. Der Plugin-Install schreibt oder
startet nichts Aktives; insbesondere führt er den Companion nicht automatisch
aus.
Der unterstützte Befehl ist `squad plugin install <local-dir>`.

Squad 2.0.0 lehnt ausführbare Dateiendungen in statischen Plugin-Manifesten
ab. Deshalb liegen die JavaScript-Module im verwalteten Bundle ohne Endung;
`node` erkennt sie durch das mitgelieferte `type: module` als ESM. Beim
Companion-Lauf werden aktive Consumer-Skripte wieder als `.mjs` materialisiert.

## Schnellstart

Vom Zielrepository aus:

```bash
git clone https://github.com/Frickeldave/squad-heroes.git /pfad/zum/squad-heroes

squad plugin validate /pfad/zum/squad-heroes
squad plugin dry-run /pfad/zum/squad-heroes
squad plugin install /pfad/zum/squad-heroes
squad plugin enable squad-heroes
squad plugin verify
```

Es gibt zwei getrennte Pläne:

1. Der Plugin-Distributionsplan listet die vollständige versionierte Distribution
   unter `templates/squad-heroes/companion/`. Das umfasst auch die statischen
   Quellen für Laufzeitmodule, Skripte, Workflows, Humanizer und Agenten. Er
   zielt nicht direkt auf aktive Consumer-Pfade wie Root-`scripts/`,
   `.github/prompts/` oder `.github/workflows/`.
2. Nach dem Plugin-Install zeigt der **kopierte Companion** in einem separaten
   Aktivierungs-Dry-run die aktiven Consumer-Ziele:

```bash
node .squad/templates/squad-heroes/companion/scripts/install --target "$PWD" --dry-run
```

Erst ein ausdrücklicher Lauf dieses kopierten Installers ohne `--dry-run`
materialisiert aktive Ziele.

Im Terminal prüft der Wizard zuerst `gh`, Host-Authentifizierung,
Repository-Lese-/Push-Rechte und den schreibfähigen `project`-Scope des aktiven
Accounts aus dem sicher gefilterten Scope-Status von
`gh auth status --hostname github.com`. Danach folgt immer ein nicht-mutierender
Project-API-Zugriffstest für den aus dem Repository abgeleiteten Owner. Diese
GitHub-Prüfungen laufen vor allen
interaktiven Auswahlmenüs; ohne angegebenes Repository ist nur dessen
unvermeidliche Abfrage nach der Host-Authentifizierung erlaubt. Die drei
**Standardmodelle** und mehrere
Projects werden mit einer TTY-Auswahl navigiert: Pfeil hoch/runter oder `j`/`k`
bewegen, Enter bestätigt, Escape oder `q` bricht ab. Nummerneingabe ist keine
Auswahlmethode. Ohne TTY muss der Installer vollständig nicht-interaktiv mit
den Modell- und ggf. Project-Flags aufgerufen werden. Die Modelle aus dem
installierten Copilot-Katalog werden benutzt, andernfalls sichtbar ein
verifiziertes Ersatzmenü. Launcher dürfen `--model` weiterhin pro Lauf
überschreiben. Profile, Sprache, Branches und die optionale Review-Baseline
bleiben Wizard-Eingaben. Die Baseline wird als lokaler Commit validiert.

Bei Board-Sync wird der Project-Owner aus `owner/repository` abgeleitet.
Project-Nummer und Zugriff werden vor Auswahl ausschließlich lesend geprüft: ein Project
wird automatisch gewählt, mehrere erscheinen in derselben Pfeiltasten-Auswahl, keines öffnet im Wizard eine Pfeiltasten-Auswahl: „Mit Companion anlegen“, „Project manuell anlegen“ oder Abbrechen/Freigeben eines vorhandenen Projects. Bei Companion-Erstellung wird der Titel vorgeschlagen, muss aber bestätigt werden; Owner bleibt aus dem Repository abgeleitet. CI benutzt `--create-project` zusammen mit `--project-title`. `--project-owner`/`--project-number` bleiben
validierte CI-Overrides; Tokens werden nie abgefragt oder gespeichert.

Das Null-Project-Menü bietet außerdem **„Project manuell anlegen“**.
Manuelle Wahl, Abbruch und jeder fehlgeschlagene automatische Apply geben die
konkreten Schritte für GitHub UI oder die verifizierte Syntax
`gh project create --owner frickeldave-test --title squad-heroes-snake` aus:
Owner/Benutzer-Project und Schreibzugriff des aktiven Accounts prüfen, danach
`gh project list --owner frickeldave-test --limit 100 --format json` ausführen.
Der kopierte Companion wird mit `--project-number <number>` erneut ausgeführt
oder das Project wird im Pfeiltastenmenü gewählt. Ein Dry-run erzeugt niemals
das Project. Nach Apply-Fehlern können Project, Schema oder Repository-Link
teilweise bestehen; zuerst die Liste prüfen, statt blind neu zu erstellen.

Für CI/Tests bleibt alles explizit und nicht-interaktiv:

```bash
node .squad/templates/squad-heroes/companion/scripts/install \
  --target "$PWD" \
  --repository owner/repository \
  --profile typescript-development \
  --language de \
  --deployment-branches 2 \
  --deployment-branch-1 main \
  --deployment-branch-2 int \
  --model-reqeng mai-code-2 \
  --model-work claude-sonnet-5.5 \
  --model-review gpt-6.1-terra \
  --dry-run
```

Nach Prüfung denselben lokal installierten Companion-Befehl ohne `--dry-run`
ausführen. Erst dieser Schritt materialisiert aktive Ziele wie
`scripts/start-work.mjs`, Workflows, Prompts und Agent-Charters. Er ist
konfliktsicher und wiederholte Ausführung ist ein No-op.


### Project-Erstellung durch Companion

Dry-run plant die extern sichtbare Project-Erstellung mit Owner und Titel sowie Schema- und Repository-Verknüpfung. Er erzeugt keine Project-Ressource und zeigt für die noch unbekannte Nummer `{{PROJECT_NUMBER}}`:

```bash
node .squad/templates/squad-heroes/companion/scripts/install --target "$PWD" \
  --repository frickeldave-test/squad-heroes-snake --enable-board-sync \
  --profile typescript-development --language en --deployment-branches 1 --deployment-branch-1 main \
  --model-reqeng mai-code-2 --model-work claude-sonnet-5.5 --model-review gpt-6.1-terra \
  --create-project --project-title squad-heroes-snake --dry-run
```

Derselbe Befehl ohne `--dry-run` ist die explizite CI-Freigabe. Erst im Apply werden Owner-ID, Project-Nummer und Node-ID über authentifiziertes `gh api graphql` ermittelt; Feld/Statusoptionen und Repository-Link folgen. `viewerCanUpdate` wird geprüft. Geplante Follow-ups tragen `PLANNED_CREATE` und werden beim Dry-run nie gegen die unbekannte Nummer aufgelöst. Beim Apply werden sie unmittelbar nach der Erstellung mit der echten Nummer erneut geprüft und ausgeführt. Im Terminal muss der angezeigte Plan zusätzlich bestätigt werden. Fehler nach der Erstellung werden als manuell zu bereinigende Teilzustände gemeldet; es wird kein automatisches Rollback behauptet. Ein gespeicherter Project-Eintrag verhindert Dubletten beim Wiederholen.

Für die laufenden Actions-Workflows ist `secrets.HEROES_PROJECT_TOKEN` fest
verdrahtet: GitHub Projects v2 gehört dem Benutzer beziehungsweise der
Organisation und benötigt für Project-Operationen ausschließlich einen PAT
(classic mit nur `project`, oder fein abgestufter PAT mit **Projects: Lesen und
Schreiben**); `repo` ist dafür nicht erforderlich und wird nicht verlangt. Das
repositorybezogene `github.token`/`GITHUB_TOKEN` kann diese Project-Berechtigung
nicht erhalten. Repository-Issue-/PR-Lesezugriffe des Workflows laufen getrennt
mit `${{ github.token }}` und den deklarierten `permissions`. Installer und
lokale Metadaten konfigurieren nur den festen Secret-Ausdruck und fragen,
lesen, speichern oder loggen niemals den Token-Wert.

Beim Verifizieren wird der Owner-Typ aus der `gh project`-Ausgabe wiederverwendet
oder vorab als GitHub User bzw. Organization aufgelöst; nur der passende
GraphQL-Zweig wird abgefragt. Ein partielles GraphQL-Ergebnis ist nur akzeptabel,
wenn ausschließlich der nicht passende Owner-Zweig `NOT_FOUND` meldet, während
Project-ID, Nummer und `viewerCanUpdate: true` gültig sind. Andere Auth-, Scope-,
Schema-, Rate- oder Netzwerkfehler bleiben hart fehlschlagend.

## Update und Entfernung

Squad 2.0.0 besitzt keinen `plugin update`-Befehl. Ein neuer Checkout wird
wieder über `install` eingespielt:

```bash
squad plugin verify &&
squad plugin install /pfad/zum/neueren/squad-heroes &&
squad plugin verify
```

Ist die Consumer-Kopie nachweislich älter, zuerst den Quellstand aktualisieren
und das Plugin **erneut installieren**; Versions-Hacks oder das Kopieren
einzelner Dateien umgehen den Plugin-Lifecycle nicht:

```bash
git -C /pfad/zum/squad-heroes pull --ff-only
squad plugin install /pfad/zum/squad-heroes
squad plugin verify
sha256sum /pfad/zum/squad-heroes/dist/companion/scripts/install
sha256sum .squad/templates/squad-heroes/companion/scripts/install
cmp /pfad/zum/squad-heroes/dist/companion/scripts/install \
  .squad/templates/squad-heroes/companion/scripts/install
node .squad/templates/squad-heroes/companion/scripts/install --target "$PWD" --dry-run
```

Der `cmp`-Befehl muss ohne Meldung und mit Exitcode 0 enden; dann sind Quell-
Installer und neu installierte Consumer-Kopie bytegleich.

Das aktualisiert das verwaltete Bundle. Aktive Companion-Ziele bleiben
unverändert. Erst ein expliziter erneuter Aufruf des lokal kopierten
Companions aktualisiert diese Ziele:

```bash
node .squad/templates/squad-heroes/companion/scripts/install --target "$PWD" --dry-run
node .squad/templates/squad-heroes/companion/scripts/install --target "$PWD"
```

Bei vorhandener `.squad/heroes.json` werden Konfigurationswerte für dieses
Companion-Rerun übernommen, außer ausdrücklich angegebene Flags. Profile,
Repository, Branches, Sprache und Modelle werden weiterhin sichtbar geplant.

`squad plugin uninstall squad-heroes` entfernt nur die Bundle-Dateien und den
Plugin-State; aktive, vom Companion erzeugte Dateien bleiben bestehen.

## Voraussetzungen und Sicherheit

- Node.js 20+, npm für die Produktentwicklung
- Squad `2.0.0` oder höher, stabil (kein Prerelease)
- lokal installierter `gh`, authentifiziert, mit Repository-Lese-/Push-Recht
  und dem schreibfähigen Scope `project` für jeden vollständigen
  Companion-Installations- oder Dry-run-Fluss. `read:project` reicht nur für
  isolierte Project-Metadaten-Lesevorgänge; Board-Einrichtung aktualisiert
  Felder, Status und Schema und benötigt daher `project`.
- genau ein stabiler `<!-- version: X.Y.Z -->`-Marker in
  `.github/agents/squad.agent.md`

Der Companion prüft Squad, GitHub-Authentifizierung sowie Repository- und
Project-Zugriff, fordert niemals Token an und speichert keine Credentials. Bei
fehlendem `project`-Scope stoppt er vor Menüs und weist ausschließlich auf
`gh auth refresh -h github.com -s project` und danach
`gh auth status --hostname github.com` hin.
Konflikte werden vor dem ersten Schreibzugriff angezeigt.

## Dokumentation

- Deutsch: [Installation](docs/de/installation.md), [Konfiguration](docs/de/konfiguration.md),
  [Sicherheit](docs/de/sicherheit.md), [Recovery](docs/de/recovery.md),
  [End-to-End-Testplan](docs/de/testplan-snake.md)
- English: [Installation](docs/en/installation.md), [Configuration](docs/en/configuration.md),
  [Security](docs/en/security.md), [Recovery](docs/en/recovery.md),
  [End-to-end test plan](docs/en/testplan-snake.md)

## Entwicklung

```bash
npm ci
npm run check
npm run smoke
squad plugin validate .
git diff --check
```

Bereits installierte Consumer, die noch die frühere direkte Quell-Installation
verwenden: Plugin aus diesem Stand erneut installieren, dann ausschließlich
die oben dokumentierte kopierte Companion-Installation verwenden. Der externe
Checkout wird nur noch benötigt, um das Plugin zu installieren/aktualisieren.
