# Installation

## Voraussetzungen

- Node.js 20+, npm, Linux und `git`.
- Squad 2.0.0 oder höher, stabil.
- Authentifiziertes `gh` mit Repository-Lese-/Push-Recht.
- Schreibfähiger Scope `project`, auch für den vollständigen Dry-run. `read:project` genügt nur für isolierte Leseabfragen.
- Genau ein stabiler `<!-- version: X.Y.Z -->`-Marker in `.github/agents/squad.agent.md`.

Der Companion prüft diese Gates vor Menüs und Writes. Er fragt niemals Token an.

Die TTY-Installation beginnt vor allen Auth- und Konfigurationsfragen mit dem Pfeiltastenmenü „Projekttyp“. Derzeit ist genau `001 Typescript developer project` auswählbar. Non-TTY benötigt ausdrücklich `--project-type 001`; es gibt keinen impliziten Standard.

## Installationssprache

Die exakte Priorität ist: explizites `--language de|en` > Sprache in vorhandener `.squad/heroes.json` > normalisiertes System-Locale (`LC_ALL`, danach `LC_MESSAGES`, danach `LANG`, danach `LANGUAGE`). Unterstützt werden nur `de` und `en`; Locale-Schreibweisen wie `de_DE.UTF-8` werden ausschließlich auf `de` normalisiert. Explizite und gespeicherte Werte müssen exakt `de` oder `en` sein. Nicht unterstützte oder mehrdeutige Werte brechen klar ab. Es gibt keinen stillen Sprachmix, keine Teilübersetzung und keinen Englisch-Fallback. Fehlt eine nutzbare Quelle, den Aufruf mit `--language de` oder `--language en` wiederholen. Die Sprache externer Squad- oder GitHub-CLI-Ausgabe ist nicht Teil dieses Vertrags.

Hilfe ist kein Sonderfall: `--language de --help` und `--help --language de` liefern deutsche Companion-Hilfe; entsprechendes gilt für `en`. Die Companion-Hilfe übernimmt nie die Sprache einer externen `ls --help`-, `gh help`- oder ähnlichen Ausgabe.

## Plugin installieren

```bash
git clone https://github.com/Frickeldave/squad-heroes.git /pfad/zum/squad-heroes
squad plugin validate /pfad/zum/squad-heroes
squad plugin dry-run /pfad/zum/squad-heroes
squad plugin install /pfad/zum/squad-heroes
squad plugin enable squad-heroes
squad plugin verify
```

Dieser **Plugin-Distributionsplan** zielt ausschließlich auf `templates/squad-heroes/companion/`. Er enthält Installer, Laufzeit, Skripte, Workflows, Humanizer und Ressourcen, verändert aber keine aktiven Root-Skripte oder `.github/`-Dateien.

## Companion aktivieren

```bash
node .squad/templates/squad-heroes/companion/scripts/install \
  --target "$PWD" \
  --dry-run
```

Der separate **Companion-Aktivierungsplan** ist eine kompakte Zusammenfassung statt eines rohen JSON-Dumps. Er gruppiert neue Dateien, vorhandene Dateien zum Zusammenführen, Project-Aktionen, unveränderte Dateien und Gesamtsummen:

```text
Plan: 82 neu, 2 zusammenführen, 0 unverändert, 0 Project-Aktionen, 0 Konflikte; Project-Status: aus.
Beispiele: scripts/start-work.mjs, .github/workflows/heroes-ci.yml, .github/prompts/startwork.prompt.md.
Dry-run: 82 neu, 2 zusammenführen, 0 unverändert, 0 Project-Aktionen, 0 Konflikte; keine Änderungen.
```

Die normale Ausgabe zeigt höchstens drei repräsentative Pfade und niemals die vollständige Ziel-Liste. `--plan-json plan.json` enthält weiterhin jeden technischen Eintrag; dieser Detailmodus muss ausdrücklich gewählt werden.

Prüfe ihn und führe denselben Befehl ohne `--dry-run` aus. Erst dieser Schritt schreibt. Unveränderte Wiederholung ist ein No-op. Mit `--plan-json plan.json` wird der maschinenlesbare Plan in eine Datei geschrieben; `--json-plan` gibt ausdrücklich JSON auf stdout aus.

TTY-Menüs verwenden Pfeile oder `j`/`k`, Enter, Escape und `q`. Ohne TTY sind Modell- und Project-Flags Pflicht:

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

Konflikte stoppen vor Writes. Pro Ziel erscheinen höchstens zwei bis drei kurze Sätze, dann der Picker und eine Abschlusszeile. Beispiel: `Für .squad/team.md fehlt noch ein markierter Squad-Heroes-Bereich. Empfohlen wird, sieben Agenten einzufügen und alle vorhandenen Inhalte unverändert zu erhalten.` Danach ist `Zusammenführen – empfohlen: vorhandene Datei ergänzen` vorausgewählt; nach der Wahl folgt nur `Entschieden: zusammenführen; lokale Inhalte bleiben erhalten.` Dasselbe knappe Muster gilt für Routing. `Details / Diff anzeigen` ist optional, begrenzt und anfangs nicht gewählt.

CI übergibt die internen Entscheidungswerte mit `--decisions`:

```json
{
  ".squad/team.md": "merge",
  ".squad/routing.md": "merge"
}
```

Der Plugin-Bestand unter `.squad/heroes/001/` wird beim Aktivieren als lokale Profilquelle nach `.squad/001/` geschrieben. Agenten-Charters werden von dort nach `.squad/agents/` materialisiert; Humanizer wird unter `.github/skills/humanizer/` installiert. Gemeinsame ReqEng-/Work-/Review-Launcher, Prompts und Workflows bleiben einmalig im shared Bundle.

## Project anlegen

Bei null Projects bietet der Wizard Companion-Anlage, manuelle Anlage und Abbruch. Owner wird aus `--repository` abgeleitet. CI benötigt `--create-project` und `--project-title`; der externe Write erfolgt nur ohne `--dry-run` nach Planfreigabe.

```bash
node .squad/templates/squad-heroes/companion/scripts/install \
  --target "$PWD" \
  --repository owner/repository \
  --enable-board-sync \
  --project-type 001 \
  --language de \
  --deployment-branches 1 \
  --deployment-branch-1 main \
  --model-reqeng mai-code-2 \
  --model-work claude-sonnet-5.5 \
  --model-review gpt-6.1-terra \
  --create-project \
  --project-title repository \
  --dry-run
```

Bei manueller Anlage `gh project create --help` prüfen, den Owner-Pfad bestätigen und nach dem Write den Companion mit `--project-number <number>` erneut starten. Bei Teilfehlern nicht blind erneut anlegen; siehe [Recovery](recovery.md).

## Aktualisieren

Es gibt kein `plugin update`. Installiere das neuere Plugin erneut:

```bash
squad plugin verify
squad plugin install /pfad/zum/neueren/squad-heroes
squad plugin verify
```

Das ersetzt nur die Plugin-Distribution. Aktive Companion-Ziele aktualisieren sich erst durch einen getrennten Dry-run und Apply des neu installierten Companions. `squad plugin uninstall squad-heroes` lässt aktive Ziele und `.squad/heroes.json` bestehen.

## Squad-Launcher reparieren

Zuerst `squad upgrade --self` als normaler Benutzer ausführen. Bei `EACCES` oder `EPERM` eines root-eigenen globalen npm-Pakets:

```bash
sudo sh -c 'umask 022 && exec npm install -g --allow-scripts=@bradygaster/squad-cli,node-pty,koffi,protobufjs @bradygaster/squad-cli@latest'
```

```bash
command -v squad
ls -l "$(command -v squad)"
squad --version
```

Danach `squad upgrade` im Consumer ausführen. Squad nie mit `sudo` starten, kein rekursives `chmod` und kein `--dangerously-allow-all-scripts`.
