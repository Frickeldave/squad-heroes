# End-to-End-Testplan: Consumer-Repository „squad-heroes-snake“

Dieses Runbook prüft das veröffentlichte Produkt außerhalb des Quellrepositories.
Es ist wiederholbar, jedoch nicht rein automatisch: GitHub- und
Browser-Prüfschritte benötigen eine freigegebene Testorganisation sowie bewusste
menschliche Bestätigung. Nie Tokens, PATs oder Credentials in Commands, Dateien
oder Protokollen ablegen.

## 1. Vorbedingungen

1. Linux, Node.js 20+, npm, `git`, `gh` und `squad` sind installiert.
   Den Launcher vor jedem Upgrade als normaler Benutzer prüfen:

   ```bash
   command -v squad
   ls -l "$(command -v squad)"
   squad --version
   ```

   Bei `Permission denied` abbrechen; die CLI weder mit `sudo` starten noch
   ein rekursives `chmod` ausführen.
2. Ein leerer GitHub-Owner/Namespace für Testzwecke ist freigegeben. Im Runbook
   steht `{owner}` ausschließlich für diesen Namespace.
3. Die aktive `gh`-Identität und die Berechtigung werden ohne Credential-Ausgabe
   geprüft:

   ```bash
   gh auth status
   gh api repos/{owner}/squad-heroes-snake --jq .permissions.push
   ```

   Erwartet: `gh auth status` ist erfolgreich. Bei einem noch nicht angelegten
   Repository ist die erste Abfrage zulässigerweise `404`; sonst muss `push`
   nachweisbar `true` sein. Falls Authentifizierung fehlt, ausschließlich den
   hostseitigen `gh auth login`-Browser-/Device-Flow verwenden.
4. Ein lokaler Checkout von `squad-heroes` liegt unter `{heroes-dir}`. Der
   getestete Stand wird unveränderlich dokumentiert:

   ```bash
   cd {heroes-dir}
   git rev-parse HEAD
   sha256sum plugin.manifest.json package-lock.json
   npm ci
   npm run check
   npm run smoke
   squad plugin validate .
   git diff --check
   ```

   Evidenz: Command-Ausgabe, Commit-ID und Prüfsummen in einem
   `evidence/`-Ordner **außerhalb des Product-Repositories**. Jeder Fehler,
   unbekannte Dirty-State oder fehlende Squad-Version beendet den Lauf.

## 2. Leeres Consumer-Repository anlegen

```bash
gh repo create {owner}/squad-heroes-snake --private --confirm
git clone git@github.com:{owner}/squad-heroes-snake.git {snake-dir}
cd {snake-dir}
git status --short
```

Erwartet: leeres Repository ohne Dateien außer dem Git-Verzeichnis. Vor dem
Klon ist der aktivierte SSH-Transport zu prüfen; alternativ den bereits von
`gh` konfigurierten HTTPS-Transport verwenden. Abbruch, wenn das Repository
existiert und nicht als eigens freigegebenes, leeres Testrepo bestätigt ist.

## 3. Unterstützte Squad-Version prüfen

Squad wird ausschließlich im Consumer-Repository initialisiert. Die autoritative
Produktquelle ist der Marker in der installierten Datei:

```bash
cd {snake-dir}
squad init
grep -c '<!-- version:' .github/agents/squad.agent.md
grep '<!-- version:' .github/agents/squad.agent.md
squad --version
```

Erwartet werden `1` von `grep -c` und genau ein Marker
`<!-- version: X.Y.Z -->` mit gültigem stabilem SemVer mindestens `2.0.0`
(beispielsweise `2.0.0`, `2.0.1` oder `3.0.0`). `squad --version` dokumentiert
die CLI zusätzlich, ersetzt die Markerprüfung aber nicht. Prereleases wie
`2.0.0-rc.1` werden fail-closed abgewiesen.

Wird `0.13.1` erkannt, ist das ein Abbruchkriterium: Die Installation darf
nicht fortgesetzt werden. Die installierte CLI als normaler Benutzer mit
`squad upgrade --self` aktualisieren. Bricht ein root-eigenes globales
npm-Paket mit `EACCES`/`EPERM` ab, genau diese globale Installation reparieren:

```bash
sudo sh -c 'umask 022 && exec npm install -g --allow-scripts=@bradygaster/squad-cli,node-pty,koffi,protobufjs @bradygaster/squad-cli@latest'
```

Squad selbst nicht unter `sudo` ausführen, keine dauerhafte globale Allowlist
speichern und nicht `--dangerously-allow-all-scripts` verwenden. Terminal neu
starten und `command -v squad`, `ls -l "$(command -v squad)"` sowie
`squad --version` wiederholen. Erst wenn alle drei Prüfungen gelingen, in
`{snake-dir}` `squad upgrade` ausführen, die Markerbefehle wiederholen und
`node {heroes-dir}/scripts/plugin-preflight.mjs --target "$PWD"` erneut starten.

## 4. Squad-Plugin installieren und aktualisieren

Frischinstallation mit dem primären Lifecycle:

```bash
cd {snake-dir}
node {heroes-dir}/scripts/plugin-preflight.mjs --target "$PWD"
squad plugin validate {heroes-dir}
squad plugin dry-run {heroes-dir}
node {heroes-dir}/scripts/plugin-preflight.mjs --target "$PWD"
squad plugin install {heroes-dir}
squad plugin enable squad-heroes
squad plugin list --json
squad plugin verify
git status --short
find .squad/plugins -maxdepth 2 -type f -print -exec sha256sum {} \;
```

Erwartet: nur deklarierte Ziele unter `.squad/` wurden geschrieben;
`.squad/plugins/*` enthält den autoritativen installierten Zustand.
`list --json` weist `squad-heroes@0.1.0` oder die aktuell geprüfte Produktversion
aus. `verify` endet erfolgreich. Companion-Dateien außerhalb der Plugin-Ziele
sind noch unverändert.

Idempotenz und realer Updatepfad:

1. Prüfsummen der Plugin-Ziele und Companion-Kontrollwerte sichern.
2. Identische Installation wiederholen:

   ```bash
   squad plugin verify &&
   squad plugin install {heroes-dir} &&
   squad plugin verify
   ```

   Erwartet: unveränderte Plugin-Zielbytes und genau ein installierter
   `squad-heroes`-Eintrag; Squad kann einen neuen Zeitstempel/Audit-Eintrag
   registrieren.
3. Eine neuere freigegebene Produktversion in `{heroes-new-dir}` auschecken.
   Prüfen, dass sich Version oder Quellinhalt tatsächlich verändert:

   ```bash
   node {heroes-new-dir}/scripts/plugin-preflight.mjs --target "$PWD"
   squad plugin validate {heroes-new-dir}
   squad plugin verify &&
   node {heroes-new-dir}/scripts/plugin-preflight.mjs --target "$PWD" &&
   squad plugin install {heroes-new-dir} &&
   squad plugin verify
   squad plugin list --json
   ```

   Erwartet: neue Version, Manifest-Prüfsumme und Datei-Prüfsummen werden in
   `.squad/plugins/*` sichtbar; neue statische Inhalte sind vorhanden.
4. Vor einem Update absichtlich eine Plugin-Datei lokal ändern und
   `squad plugin verify` ausführen. Erwartet: `checksum mismatch`, Status
   ungleich null, keine State- oder Dateiänderung durch `verify`. Die Datei
   bewusst wiederherstellen, nicht mit einer stillen Installation überdecken.

## 5. Companion und bereitgestellte Flows

```bash
cd {heroes-dir}
node scripts/install.mjs --help
node scripts/install.mjs \
  --target {snake-dir} \
  --repository {owner}/squad-heroes-snake \
  --profile typescript-development \
  --deployment-branches 1 \
  --deployment-branch-1 main \
  --language de \
  --dry-run
```

Vorbedingungen: freigegebene Modell-IDs und vollständige nicht-interaktive
Eingaben liegen vor. Erwartet: vollständiger Plan, keine Writes, beide Version-
Gates, kein Token-Dialog, getrennte Plugin-/Companion-Ownership.

Den identischen Befehl ohne `--dry-run` ausführen. Danach:

```bash
cd {snake-dir}
git status --short
git diff -- . ':!package-lock.json'
find scripts .github/prompts .github/workflows .squad/agents -type f -print
node scripts/install.mjs --help
node scripts/start-reqeng.mjs --help
node scripts/start-work.mjs --help
node scripts/start-review.mjs --help
node scripts/update-badges.mjs --check
node scripts/versionbump.mjs --help
node scripts/check-release-label.mjs --help
```

Erwartet: jeder gelieferte Einstieg ist vorhanden und liefert eine sichere
Diagnose oder Hilfe. Noch nicht freigegebene externe Board-Writes bleiben aus.
Einen zweiten Companion-Lauf mit identischen Eingaben ausführen; erwartet wird
`changed: 0` beziehungsweise ein bytegleicher no-op.

Konflikttest: einen verwalteten lokalen Markerblock kontrolliert ändern, Dry-run
wiederholen und alle drei Fassungen/Optionen protokollieren. Abbruch ohne Write
bei ungeklärtem Konflikt; anschließend genau eine dokumentierte Entscheidung
anwenden. `history.md` darf nur append-only wachsen. Ein Profilwechsel muss
fail-closed abbrechen.

Update: `{heroes-new-dir}` mit dem Companion erneut planen, Konflikte sichtbar
entscheiden und denselben Idempotenzlauf wiederholen. Der laufende Plugin-State
unter `.squad/plugins/*` muss bytegleich bleiben.

## 6. Snake-Ticket erstellen

Das Ticket beschreibt ausschließlich das Testprodukt. Minimaler Body:

- Ziel: browserbasiertes Snake-Spiel.
- Akzeptanz: Start/Stop, Richtungstasten, Essen/Wachstum, Selbst-/Wandkollision,
  Punktestand, Game Over, Restart, deterministische Kernlogik.
- Qualitätsgates: Unit-Tests, Build/Check, Reviewer-Freigabe.

```bash
cd {snake-dir}
gh issue create --repo github.com:{owner}/squad-heroes-snake \
  --title "Build browser-based Snake game" \
  --body-file evidence/snake-issue.md
gh issue list --repo github.com:{owner}/squad-heroes-snake --state open
```

Ticketnummer `{snake-issue}` sichern. Erwartet: genau ein neuer Testfall; kein
fremdes Ticket wird geändert.

## 7. Vollständige Squad-Workflow-Kette

1. ReqEng/Issue mit `node scripts/start-reqeng.mjs --issue {snake-issue}` und
   den vom Produkt unterstützten Flags aus `--help` starten.
2. Antworten gesammelt und diagnostisch eindeutig erfassen. Blocking-Fragen
   müssen vor Work geschlossen sein. Auf denselben stabilen Frageblock erneut
   auswerten; Duplikate sind ein Fehler.
3. Work mit `node scripts/start-work.mjs --issue {snake-issue}` starten.
4. Branch, Worktree/tmux-Sitzung, aufgelöste Modell-ID, Subagent-Modell und
   Entscheidungen protokollieren:

   ```bash
   git branch --show-current
   git worktree list
   git log --oneline -5
   gh issue view {snake-issue} --repo github.com:{owner}/squad-heroes-snake
   ```

   Erwartet: Branch/Issue-Referenz eindeutig; genau eine validierte Modell-ID
   wird unverändert an alle nachgelagerten Operationen weitergegeben.
5. Implementierung, Test und Dokumentation durch die erzeugte Squad-Kette
   ausführen. Commit(s) dürfen keine Credentials enthalten.
6. PR mit `gh pr create` und Referenz auf `{snake-issue}` öffnen. Anschließend:

   ```bash
   gh pr view --repo github.com:{owner}/squad-heroes-snake
   gh pr checks --repo github.com:{owner}/squad-heroes-snake --watch --fail-fast
   gh pr view --json reviewDecision,mergeable,state
   ```

   Kein Ready/Merge bei Fehlern, fehlendem Review oder offenem Gate.
7. Review mit `node scripts/start-review.mjs --pr {snake-pr}` starten. Baseline
   muss Run-Override, konfigurierte Baseline oder PR-Base sein, niemals Head.
8. Nach erfolgreicher Freigabe mergen und den Ticket-Abschlusskommentar mit
   Tests und Commit-Evidenz hinzufügen. Scribe/Entscheidungen müssen genau auf
   die vereinbarten Inhalte aktualisiert sein, ohne doppelte Blöcke.

## 8. Snake funktional prüfen

Automatisch, soweit vom Consumer-Framework unterstützt:

```bash
cd {snake-dir}
npm ci
npm test
npm run build
npm run check
```

Tests müssen mindestens beweisen:

- deterministischer Startzustand bei festem Seed;
- Bewegung in jede Richtung ohne diagonale Schritte;
- Essen erhöht Länge und Punktestand;
- Wand- und Selbstkollision ergeben Game Over;
- Neustart erzeugt wieder den Startzustand;
- Eingaben können nicht sofort in die Gegenrichtung kehren;
- identische Aktionsfolge erzeugt identischen Zustand.

Fehlender Test, build error, flüchtiger Zustand oder nicht reproduzierbare
Ausgabe bricht den Lauf ab.

Manuelle Browserprüfung:

1. Lokalen Server nach der erzeugten README starten.
2. Start, Tastatursteuerung, Wachstum, Game Over und Restart in Desktop-Browser
   prüfen; zusätzlich Touch/Mobilkontrolle, falls angeboten.
3. Keine sichtbare diagonale Bewegung, blockiertes UI oder doppeltes Restart-
   Verhalten. Konsole und Netzwerktab ohne Fehler.
4. Browser, Version, Zeitstempel und Screenshot als Freigabeevidenz ablegen.

## 9. Abbruch, Cleanup und Nachweis

Bei jedem Fehler: laufende Commands, Workflow-Jobs oder Server stoppen; den
aktuellen Schritt, Command, Exit-Code und unveränderte Checks protokollieren.
Nichts weiter mutieren, sobald das Eigentum eines Ressourcennamens unklar ist.

Bei `bash: /usr/bin/squad: Permission denied` Symlink und aufgelösten Pfad
protokollieren, Dateirechte einzelner Abhängigkeiten nicht verändern und die
dokumentierte globale Neuinstallation mit `umask 022` wiederholen. Danach
Terminal neu starten und alle drei Launcher-Prüfungen bestehen, bevor Produkt-
oder Test-Repository-Upgrade fortgesetzt wird.

Nur nach erfolgreichem oder bewusst abgebrochenem Test:

```bash
cd {snake-dir}
git worktree list
gh pr list --repo github.com:{owner}/squad-heroes-snake --state open
gh issue list --repo github.com:{owner}/squad-heroes-snake --state open
```

1. Alle ausschließlich für diesen Lauf erstellten Worktrees mit
   `git worktree remove {path}` entfernen.
2. Identifizierte tmux-Sitzungen namentlich mit `tmux kill-session -t {name}`
   beenden; keine Namensmuster oder fremden Sitzungen verwenden.
3. Testbranches nach finalem Commit nur aus diesem Repository löschen; sichere
   `gh pr close`-/`gh branch-delete`-Operationen und explizite Bestätigung nutzen.
4. Lokale Evidenz gemäß Aufbewahrungsregel verschieben. Temporäre Checkouts nur
   nach Besitzer-/Pfadvergleich entfernen.
5. Ist das isolierte Testrepo nicht mehr benötigt:

   ```bash
   gh repo delete github.com:{owner}/squad-heroes-snake --yes
   ```

   Dieser irreversible Schritt ist vom Menschen ausdrücklich zu bestätigen.
6. `gh auth status` erneut prüfen; den Credential-Store **nicht** verändern.
   Keine Berechtigung wird global entzogen, wenn sie noch anderen freigegebenen
   Arbeiten dient.

Finale Evidenz enthält: Commit-IDs, `list --json`, Plugin-Checksummen, Companion-
Plan, Ticket-/PR-Nummern, Check-/Review-Ergebnisse, Modell-/Scribe-Nachweis,
Browserdaten und Cleanup-Protokoll.
