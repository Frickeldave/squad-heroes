# squad-heroes

Marketplace-fähiges Squad-Overlay und separat versionierter, lokal ausgeführter Companion für TypeScript-Projekte.

## Funktionsumfang

Der Squad-Plugin-Lifecycle verwaltet die statische Distribution unter `.squad/templates/squad-heroes/companion/`. `squad plugin install` kopiert sie, startet den Companion aber nicht. Ein späterer, ausdrücklicher Aufruf des kopierten Installers materialisiert die aktiven Ziele wie `scripts/`, Prompts, Workflows und Agent-Charters.

Die Distribution enthält Installer, Laufzeitquellen, Skripte, Workflows, Ressourcen, Humanizer-Dateien und Agenten. JavaScript-Module liegen im statischen Bundle absichtlich ohne Endung, weil Squad 2.0 ausführbare Endungen ablehnt. Beim Companion-Lauf werden aktive Consumer-Skripte als `.mjs` erzeugt.

## Schnellstart

Voraussetzungen: Node.js 20+, npm, Squad 2.0.0+ (stabil), `git` und authentifiziertes `gh`.

```bash
git clone https://github.com/Frickeldave/squad-heroes.git /pfad/zum/squad-heroes
squad plugin validate /pfad/zum/squad-heroes
squad plugin dry-run /pfad/zum/squad-heroes
squad plugin install /pfad/zum/squad-heroes
squad plugin enable squad-heroes
squad plugin verify
```

Der **Plugin-Distributionsplan** zeigt nur versionierte Dateien unter `templates/squad-heroes/companion/`. Danach planst und aktivierst du den installierten Companion separat:

Am Anfang jeder TTY-Installation erscheint die Projekttyp-Auswahl mit genau einem Eintrag: `001 Typescript developer project`. Nicht-interaktive Läufe müssen ausdrücklich `--project-type 001` übergeben; ein impliziter Default ersetzt das Menü nicht.

```bash
node .squad/templates/squad-heroes/companion/scripts/install \
  --target "$PWD" \
  --dry-run
node .squad/templates/squad-heroes/companion/scripts/install \
  --target "$PWD"
```

Der zweite Befehl schreibt erst nach Freigabe des **Companion-Aktivierungsplans**. Wiederholte Ausführung mit unveränderten Eingaben ist ein No-op.

Für CI und andere nicht-interaktive Läufe müssen alle Modell- und Branchwerte explizit sein:

```bash
node .squad/templates/squad-heroes/companion/scripts/install \
  --target "$PWD" \
  --repository owner/repository \
  --project-type 001 \
  --language de \
  --deployment-branches 2 \
  --deployment-branch-1 main \
  --deployment-branch-2 int \
  --model-reqeng mai-code-2 \
  --model-work claude-sonnet-5.5 \
  --model-review gpt-6.1-terra \
  --dry-run
```

  Profil 001 liegt in der installierten Quelle `.squad/001/`: Profil, Agenten und Humanizer. Aktive Agent-Charters werden daraus nach `.squad/agents/` materialisiert. ReqEng, Work und Review bleiben eine gemeinsame Flow-Basis und werden nicht pro Typ dupliziert.

## Verhalten

- Der Companion verlangt genau einen stabilen `<!-- version: X.Y.Z -->`-Marker in `.github/agents/squad.agent.md`, mindestens 2.0.0.
- Vor Menüs prüft er `gh`, Host-Authentifizierung, Account, Repository-Rechte und den lesenden Project-API-Zugriff. Der schreibfähige Scope `project` ist auch im Dry-run Pflicht, selbst ohne Board-Sync.
- Profile, Sprache, Branches und optionale Review-Baseline bleiben explizit. Die Baseline muss zu einem lokalen Commit auflösen.
- TTY-Auswahl funktioniert mit Pfeilen oder `j`/`k`, Enter, Escape und `q`; Zifferneingabe ist kein Auswahlmechanismus.
- Lokale Konflikte stoppen vor Writes. Je Ziel ist `use`, `keep`, `merge` oder `abort` erforderlich; CI übergibt sie mit `--decisions`.
- `--model ID` überschreibt ein Flow-Modell nur für den jeweiligen Launcher-Aufruf.
- Tokens werden nie erfragt, gespeichert oder in Logs ausgegeben.

Board-Sync leitet den Project-Owner aus `owner/repository` ab. Ein Project wird automatisch gewählt, mehrere Projekte erscheinen im Picker, und ohne Project gibt es die Optionen Companion-Anlage, manuelle Anlage und Abbruch. Nur der Apply darf eine externe Ressource anlegen. Details und Recovery stehen in [Konfiguration](docs/de/konfiguration.md) und [Recovery](docs/de/recovery.md).

## Aktualisierung und Entfernung

Squad 2.0 besitzt keinen `plugin update`-Befehl. Installiere die neue Distribution erneut:

```bash
squad plugin verify
squad plugin install /pfad/zum/neueren/squad-heroes
squad plugin verify
```

Aktive Companion-Ziele ändern sich dabei nicht. Prüfe und aktiviere sie anschließend mit dem neu installierten lokalen Installer. `squad plugin uninstall squad-heroes` entfernt nur die Plugin-Distribution, nicht aktive Companion-Dateien oder `.squad/heroes.json`.

Bei einer nachweislich veralteten Consumer-Kopie:

```bash
git -C /pfad/zum/squad-heroes pull --ff-only
squad plugin install /pfad/zum/squad-heroes
squad plugin verify
sha256sum /pfad/zum/squad-heroes/dist/companion/scripts/install
sha256sum .squad/templates/squad-heroes/companion/scripts/install
cmp /pfad/zum/squad-heroes/dist/companion/scripts/install \
  .squad/templates/squad-heroes/companion/scripts/install
```

`cmp` muss mit Exitcode 0 enden. Folgefehler und manuelle Project-Wiederherstellung sind in [Recovery](docs/de/recovery.md) beschrieben.

## Dokumentation

- [Installation](docs/de/installation.md): Lifecycle, Installation, Upgrade und Project-Anlage
- [Konfiguration](docs/de/konfiguration.md): State, Modelle, Prompt-Layer und Branches
- [Sicherheit](docs/de/sicherheit.md): Ownership, Berechtigungen und Credentials
- [Recovery](docs/de/recovery.md): Konflikte, typische Fehler und Wiederaufnahme
- [Workflows](docs/de/workflows.md): CI, Release, Badges, ReqEng und Board-Sync
- [Nicht-Ziele](docs/de/nicht-ziele.md)
- [End-to-End-Testplan](docs/de/testplan-snake.md) und [Issue-Vorlage](docs/de/testplan-snake-issue.md)

## Entwicklung

```bash
npm ci
npm run check
npm run smoke
squad plugin validate .
git diff --check
```

Weitere Referenz: [American English](README-en.md).
