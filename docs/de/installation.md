# Installation

## Architektur

Das Squad-Plugin besitzt die vollständige versionierte Distribution unter
`.squad/templates/squad-heroes/companion/`. Sie enthält den Installer sowie
statische Quellkopien der Laufzeit unter `src/`, von Skripten, `.squad/heroes/`,
Workflows, Vorlagen, Ressourcen, lokalisierten Humanizer-Dateien und
Paketmetadaten. Squad 2.0 erfasst und kopiert diese Distribution, führt sie
aber nie aus.

Der installierte Companion besitzt seine später ausdrücklich materialisierten
aktiven Consumer-Ziele. Plugin verify/update/uninstall besitzen, aktualisieren
oder entfernen diese aktiven Ziele daher nicht.

## Vorprüfung

Der Companion verlangt genau einen stabilen Squad-Marker
`<!-- version: X.Y.Z -->` in `.github/agents/squad.agent.md`, mindestens 2.0.0.
Er prüft ihn vor der Planung und erneut vor dem Schreiben. Fehlende, doppelte,
ungültige, Prerelease- oder ältere Marker stoppen mit Exitcode 2.

Zusätzlich werden beim Start `gh`, Host-Authentifizierung, authentifizierter
Account und nicht-mutierende Repository-Lese-/Push-Rechte geprüft. Der
schreibfähige `project`-Scope wird aus der sicher gefilterten Scope-Zeile des
aktiven Accounts in `gh auth status --hostname github.com` bewiesen. Danach folgt
für den aus dem Repository abgeleiteten Project-Owner eine nicht-mutierende
Project-API-Prüfung, deren Ergebnis sicher zwischengespeichert wird. Alle
GitHub-Prüfungen erfolgen vor Profil-, Repository-, Modell-, Sprach-, Branch-,
Review-Baseline- oder Project-Auswahl. Fehlt das Repository, folgt auf die
Authentifizierung ausschließlich die unvermeidliche Repository-Abfrage. Der
`project`-Scope und API-Test sind für jeden vollständigen Wizard-,
Installations- und Dry-run-Fluss verpflichtend, auch wenn Board-Sync
anschließend deaktiviert bleibt. Isolierte Project-Metadaten-Lesevorgänge
können technisch `read:project` nutzen; die Board-Einrichtung von squad-heroes
ändert jedoch Felder, Status und Schema und benötigt deshalb `project`. Der
Companion fragt weder Token ab noch akzeptiert oder persistiert er sie. Eine zu
alte Squad-Version wird mit dem unten beschriebenen
normalen Upgrade-Fluss repariert; Squad selbst nie mit `sudo` ausführen.

## Erstinstallation

Den Plugin-Quellstand im Consumer-Repository nur zum Installieren beschaffen:

```bash
git clone https://github.com/Frickeldave/squad-heroes.git /pfad/zum/squad-heroes
squad plugin validate /pfad/zum/squad-heroes
squad plugin dry-run /pfad/zum/squad-heroes
squad plugin install /pfad/zum/squad-heroes
squad plugin enable squad-heroes
squad plugin verify
```

Es gibt zwei Pläne. Der **Plugin-Distributionsplan** listet das vollständige
versionierte Paket, einschließlich
`templates/squad-heroes/companion/scripts/install`,
`templates/squad-heroes/companion/src/installer`, Skript- und
Workflowquellen, Ressourcen sowie Humanizer-Dateien. Jedes Ziel bleibt unter
`templates/squad-heroes/companion/`; aktive Root-Pfade wie `scripts/`,
`.github/prompts/` oder `.github/workflows/` werden nicht direkt angezielt.

Den kopierten Einstiegspunkt aus dem Consumer aufrufen:

```bash
node .squad/templates/squad-heroes/companion/scripts/install \
  --target "$PWD" \
  --dry-run
```

An einem TTY erfragt ein Wizard Profil, Repository, Sprache und
Deployment-Branches. Die drei **Standardmodelle der Flows** und mehrere
Projects nutzen eine Pfeiltasten-Auswahl: Hoch/Runter oder `j`/`k` bewegen,
Enter bestätigt, Escape/`q` bricht ab. Nummerneingabe wird nicht akzeptiert.
Ohne TTY wird interaktiv abgebrochen und Automation auf die
nicht-interaktiven Modell-/Project-Flags verwiesen. Ist Erkennung nicht
verfügbar, wird sichtbar eine verifizierte Ersatzliste benutzt. Der
Launcher-Override `--model` bleibt pro Lauf verfügbar. Die optionale
Review-Baseline ist eindeutig beschriftet und muss im Ziel als Commit auflösbar
sein.

Der erste Aktivierungsplan wird vor jedem Write ausgegeben. Enthält er lokale
Konflikte, werden pro Ziel Abschnitt sowie kompakte lokale/eingehende Vorschau
gezeigt und danach eine Pfeiltasten-Auswahl geöffnet. `use`, `keep`, `merge`
oder `abort` wählen und mit Enter bestätigen. Nur bei einer **frischen
Squad-2.0-Datei ohne verwalteten Marker** wird `merge` ausdrücklich empfohlen:
Der eingehende verwaltete Abschnitt wird hinter allen vorhandenen lokalen Bytes
eingefügt. Diese Empfehlung gilt nicht pauschal für Dateien mit Markern oder
sonstige uneindeutige Inhalte. Danach baut Companion den Plan neu und zeigt ihn
erneut an. Der Dry-run endet anschließend mit `changed: 0`; ein Apply schreibt
erst nach Freigabe dieses aufgelösten Plans. Die exakten Entscheidungen werden
für Recovery in `.squad/heroes.json` gespeichert.

Beim Board-Opt-in werden Owner und Nummer nicht eingegeben: Der Owner wird stets
aus `--repository` abgeleitet, Projects werden lesend über `gh` erkannt. Ein
Project wird automatisch gewählt, mehrere erscheinen in derselben Pfeiltasten-Auswahl, keines stoppt
vor Planung mit konkreter Setup-/Zugriffsanleitung. Das Null-Menü enthält
„Mit Companion anlegen“, „Project manuell anlegen“ und Abbrechen; manuelle Wahl
und Abbruch geben dieselbe konkrete Wiederherstellung aus. Für CI bleiben
`--project-number` und ein dazu passender `--project-owner` als stets per API
validierte Overrides möglich. Vor einer mutierenden Board-Konfiguration prüft
eine frische GraphQL-Abfrage `viewerCanUpdate`; der spätere Workflow wiederholt
diese Prüfung unmittelbar vor dem ersten Project-Schreibzugriff. Dry-run führt
nur Leseprüfungen aus. Leere
optionale Werte nutzen sichtbare Bestandswerte. Nicht-interaktive CI übergibt:

```bash
node .squad/templates/squad-heroes/companion/scripts/install \
  --target "$PWD" --repository owner/repository \
  --profile typescript-development --language de \
  --deployment-branches 2 \
  --deployment-branch-1 main --deployment-branch-2 int \
  --model-reqeng mai-code-2 \
  --model-work claude-sonnet-5.5 \
  --model-review gpt-6.1-terra \
  --decisions .squad/heroes-decisions.json \
  --dry-run
```

CI übergibt `--decisions` nur, wenn der erste Plan ungeklärte Konflikte
meldet. Die Datei ist ein JSON-Objekt mit exakten Zielpfaden als Schlüsseln:

```json
{
  ".squad/team.md": "merge",
  ".squad/routing.md": "merge"
}
```

Als Werte sind ausschließlich `use`, `keep`, `merge` oder `abort` erlaubt. CI
erhält keine TTY-Abfrage und stoppt vor lokalen oder Project-Writes, wenn eine
benötigte Entscheidung fehlt.

Das ist der separate **Companion-Aktivierungsplan**. Er zeigt aktive Ziele wie
`scripts/start-work.mjs`, `.github/prompts/`,
`.github/workflows/heroes-ci.yml` und Agent-Dateien. Nach Prüfung denselben
kopierten Befehl ohne `--dry-run` ausführen. Nur dieser ausdrückliche Lauf
schreibt aktive Dateien. Wiederholung ist ein No-op, solange genehmigte
Konfiguration und Paketinhalt gleich bleiben.

## Root-eigene globale Squad-Installation reparieren

Zuerst `squad upgrade --self` als normaler Benutzer ausführen. Bei `EACCES`
oder `EPERM` eines root-eigenen npm-Pakets nur dieses globale Paket reparieren:

```bash
sudo sh -c 'umask 022 && exec npm install -g --allow-scripts=@bradygaster/squad-cli,node-pty,koffi,protobufjs @bradygaster/squad-cli@latest'
```

Terminal neu starten und prüfen:

```bash
command -v squad
ls -l "$(command -v squad)"
squad --version
```

Weder `sudo squad`, rekursives `chmod` noch
`--dangerously-allow-all-scripts` verwenden. Nach erfolgreichem Launcher
`squad upgrade` im Consumer ausführen und den Marker prüfen.

## Aktualisierung

Es gibt keinen unterstützten `plugin update`-Befehl. Eine neue Distribution
wird erneut installiert:

```bash
squad plugin verify &&
squad plugin install /pfad/zum/neueren/squad-heroes &&
squad plugin verify
```

Nur die Plugin-eigene Distribution wird ersetzt. Aktive Companion-Ziele ändern
sich dabei nicht. Ihre Änderungen erst durch erneuten ausdrücklichen Aufruf der
neu installierten lokalen Kopie prüfen und anwenden:

```bash
node .squad/templates/squad-heroes/companion/scripts/install --target "$PWD" --dry-run
node .squad/templates/squad-heroes/companion/scripts/install --target "$PWD"
```

Die installierte Kopie ist selbstständig; der externe Checkout wird während
der Companion-Installation nicht verwendet. `squad plugin uninstall
squad-heroes` entfernt nur die verwaltete Distribution, nicht die bereits vom
Companion erzeugten aktiven Dateien.

## Durch Companion erstellte Projects

Bei aktiviertem Board-Sync und null sichtbaren Projects zeigt der Wizard ein Pfeiltastenmenü: Project mit Companion anlegen, manuell anlegen oder abbrechen/ein vorhandenes bereitstellen. Owner `frickeldave-test` wird abgeleitet, Titel `squad-heroes-snake` vorgeschlagen und Titel sowie Owner explizit bestätigt. In CI sind `--create-project` und `--project-title` gemeinsam Pflicht; `--create-project=false` ist ungültig.

Schlägt die manuelle oder automatische Bereitstellung fehl, am aktiven
GitHub-Konto anmelden und ein Benutzer-Project unter Owner
`frickeldave-test` mit Titel `squad-heroes-snake` anlegen. GitHub UI: Avatar →
**Your projects** → **New project**. Alternativ, nachdem
`gh project create --help` die Syntax bestätigt hat, sicher:

```bash
gh project create --owner frickeldave-test --title squad-heroes-snake
```

Dem aktiven Account im Project Schreibzugriff geben und prüfen:

```bash
gh project list --owner frickeldave-test --limit 100 --format json
```

Danach den kopierten Companion mit `--project-number <number>` erneut starten
oder im TTY-Menü auswählen. Dry-run kann das Project nicht anlegen. Bei einem
Apply-Fehler kann das Project teilweise bestehen beziehungsweise Schema oder
Repository-Link teilweise eingerichtet sein; zuerst die Liste und den
Project-Zustand prüfen, keine Secret-Werte kopieren und nicht blind erneut
erstellen. `HEROES_PROJECT_TOKEN` braucht nur `project`; Repositoryzugriffe
bleiben bei `github.token`.

Exakter Dry-run (keine GitHub-Mutation):

```bash
node .squad/templates/squad-heroes/companion/scripts/install --target "$PWD" --repository frickeldave-test/squad-heroes-snake --enable-board-sync --profile typescript-development --language en --deployment-branches 1 --deployment-branch-1 main --model-reqeng mai-code-2 --model-work claude-sonnet-5.5 --model-review gpt-6.1-terra --create-project --project-title squad-heroes-snake --dry-run
```

Ohne `--dry-run` wird derselbe Befehl zum Apply. Nach lokalen Konfliktprüfungen wird authentifiziertes `gh api graphql` verwendet; echte Nummer/Node-ID werden ermittelt, Statusfeld/-optionen sowie Repository-Link konfiguriert und `viewerCanUpdate` geprüft. Anschließend wird `.squad/heroes.json` geschrieben. Im Terminal ist nach dem angezeigten Plan eine weitere Freigabe nötig. Bei externem Teilfehler kann manuelle Bereinigung nötig sein; es gibt kein behauptetes automatisches Rollback.
