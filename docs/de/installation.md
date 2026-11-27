# Installation

## Architektur

Das Squad-Plugin besitzt nur eine versionierte, statische Distribution unter
`.squad/templates/squad-heroes/companion/`. Sie enthält Installer,
endunglose ESM-Laufzeitmodule, Paketmetadaten, Vorlagen, Profile, Agenten,
lokalisierte Humanizer-Ressourcen, Meldungen, Zielkatalog, Skripte und
Workflows. Squad 2.0 erfasst und kopiert diese Distribution, führt sie aber nie
aus.

Der installierte Companion besitzt seine später ausdrücklich materialisierten
aktiven Consumer-Ziele. Plugin verify/update/uninstall besitzen, aktualisieren
oder entfernen diese aktiven Ziele daher nicht.

## Vorprüfung

Der Companion verlangt genau einen stabilen Squad-Marker
`<!-- version: X.Y.Z -->` in `.github/agents/squad.agent.md`, mindestens 2.0.0.
Er prüft ihn vor der Planung und erneut vor dem Schreiben. Fehlende, doppelte,
ungültige, Prerelease- oder ältere Marker stoppen mit Exitcode 2.

Zusätzlich müssen `gh auth status` und eine nicht-mutierende Push-Rechteprüfung
erfolgreich sein. Der Companion fragt weder Token ab noch akzeptiert oder
persistiert er sie. Eine zu alte Squad-Version wird mit dem unten beschriebenen
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

Der Squad-Dry-run listet das vollständige statische Paket, einschließlich
`templates/squad-heroes/companion/scripts/install`,
`templates/squad-heroes/companion/src/installer` und Workflow-/Skriptquellen.
Direkte aktive Consumer-Pfade dürfen nicht erscheinen.

Den kopierten Einstiegspunkt aus dem Consumer aufrufen:

```bash
node .squad/templates/squad-heroes/companion/scripts/install \
  --target "$PWD" \
  --dry-run
```

An einem TTY erfragt ein Wizard Profil, Repository, Sprache, Anzahl/Namen der
Deployment-Branches, Review-Baseline, alle drei expliziten Flow-Modelle und
optionales Project-Board-Sync. Leere optionale Werte nutzen angezeigte
Bestands-/Standardwerte. Nicht-interaktive CI übergibt die vorhandenen Flags:

```bash
node .squad/templates/squad-heroes/companion/scripts/install \
  --target "$PWD" --repository owner/repository \
  --profile typescript-development --language de \
  --deployment-branches 2 \
  --deployment-branch-1 main --deployment-branch-2 int \
  --model-reqeng mai-code-2 \
  --model-work claude-sonnet-5.5 \
  --model-review gpt-6.1-terra \
  --dry-run
```

Der Companion-Dry-run muss `scripts/start-work.mjs`,
`.github/workflows/heroes-ci.yml` und aktive Agent-Charters enthalten. Nach
Prüfung denselben kopierten Befehl ohne `--dry-run` ausführen. Wiederholung ist
ein No-op, solange genehmigte Konfiguration und Paketinhalt gleich bleiben.

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
