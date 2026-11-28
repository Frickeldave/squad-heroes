# End-to-End-Testplan: `squad-heroes-snake`

Prüfe `{heroes-dir}`, einen freigegebenen GitHub-Owner `{owner}` und den leeren Consumer-Checkout `{snake-dir}`. Speichere Evidenz außerhalb beider Repositories. Tokens oder PATs nie in Commands, Dateien oder Protokollen ausgeben.

Startgate: Im TTY muss die Companion-Installation als allererste Interaktion das Menü „Project type“ mit genau `001 Typescript developer project` zeigen. Im Non-TTY muss `--project-type 001` explizit gesetzt sein; fehlendes Flag bricht ab.

## Voraussetzungen

- Linux, Node.js 20+, npm, `git`, `gh`, Squad und eine TTY für die interaktiven Fälle.
- Ein leerer, freigegebener Namespace `{owner}` und ein noch freies Repository `squad-heroes-snake`.
- Authentifiziertes `gh` mit Repository-Push und schreibfähigem Project-Scope.

```bash
command -v squad
ls -l "$(command -v squad)"
squad --version
gh auth status --hostname github.com
gh api repos/{owner}/squad-heroes-snake --jq .permissions.push
```

Gate: `gh auth status` gelingt. Vor Erstellung darf die Repository-Abfrage `404` liefern; danach muss `push` `true` sein. Bei einem `Permission denied` am Squad-Launcher nicht mit `sudo` oder rekursivem `chmod` fortfahren; die [Installation](installation.md) enthält die begrenzte Reparatur.

## Produktstand prüfen

```bash
cd {heroes-dir}
git rev-parse HEAD
sha256sum plugin.manifest.json package-lock.json
git status --short
npm ci
npm run check
npm run smoke
squad plugin validate .
git diff --check
```

Gate: alle Befehle gelingen und der Produktstand ist dokumentiert. Commit-ID und Prüfsummen sichern.

## Consumer erstellen und Squad prüfen

```bash
gh repo create {owner}/squad-heroes-snake --private --confirm
git clone git@github.com:{owner}/squad-heroes-snake.git {snake-dir}
cd {snake-dir}
git status --short
squad init
grep -c '<!-- version:' .github/agents/squad.agent.md
grep '<!-- version:' .github/agents/squad.agent.md
squad --version
```

Gate: ein genau ein `<!-- version: X.Y.Z -->`-Marker existiert und hat stabiles SemVer ab `2.0.0`. Prereleases und ältere Versionen brechen vor jeder Installation ab. Nach `squad upgrade --self` und gegebenenfalls der Repair-Anweisung Marker und `node {heroes-dir}/scripts/plugin-preflight.mjs --target "$PWD"` erneut ausführen.

## Plugin-Lifecycle prüfen

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

Gate des **Plugin-Distributionsplans** (`plugin distribution plan`):

- komplette Distribution nur unter `templates/squad-heroes/companion/`;
- repräsentative Ziele wie `templates/squad-heroes/companion/src/installer`, `templates/squad-heroes/companion/.squad/heroes/001/agents/tony.en.md` und `templates/squad-heroes/companion/.squad/heroes/companion/workflows/heroes-ci.yml`;
- die statische Quellenreferenz `.squad/heroes/companion/workflows/heroes-ci.yml` ist weiterhin enthalten;
- keine direkten Ziele `scripts/`, `.github/prompts/` oder `.github/workflows/`;
- `list --json` nennt die getestete Version, `verify` gelingt, aktive Ziele bleiben unverändert.

Idempotenz:

```bash
squad plugin verify
squad plugin install {heroes-dir}
squad plugin verify
```

Gate: Zielbytes bleiben gleich und genau ein `squad-heroes`-Eintrag existiert. Ändere danach absichtlich ein Plugin-Ziel; `verify` muss mit `checksum mismatch` fehlschlagen, ohne Dateien zu ändern. Stelle die Datei bewusst wieder her.

Ein neuer freigegebener Checkout `{heroes-new-dir}` muss sich in Version oder Inhalt unterscheiden. Wiederhole Validate, Verify, Install und Verify. Gate: neue Version und Prüfsummen erscheinen in `.squad/plugins/*`.

## Companion-Aktivierung prüfen

```bash
cd {snake-dir}
node .squad/templates/squad-heroes/companion/scripts/install --help
node .squad/templates/squad-heroes/companion/scripts/install \
  --target {snake-dir} \
  --repository {owner}/squad-heroes-snake \
  --project-type 001 \
  --deployment-branches 1 \
  --deployment-branch-1 main \
  --language de \
  --model-reqeng mai-code-2 \
  --model-work claude-sonnet-5.5 \
  --model-review gpt-6.1-terra \
  --dry-run
```

Gate des **Companion-Aktivierungsplans** (`Companion activation plan`):

- Prüfungen laufen in dieser Reihenfolge: `gh`, Auth/Account, Repository-Lese-/Push-Rechte, Project-API-Zugriff; `project` wird sicher aus der Statuszeile belegt.
- Das gilt vor Prompt, Modell-Discovery, Menü und Ausgabe sowie bei `--dry-run` und deaktiviertem Board-Sync. `read:project` allein scheitert.
- Fehlender Scope zeigt nur `gh auth refresh -h github.com -s project` und `gh auth status --hostname github.com`.
- `scripts/start-work.mjs`, weitere Skripte, `.github/prompts/` und `.github/workflows/heroes-ci.yml` erscheinen; nichts wird geschrieben.
- 403/404-Hinweise, `viewerCanUpdate` vor Board-Mutation und die zweite Prüfung vor dem ersten Project-Write sind nachweisbar.
- `.squad/001/profile.json`, Agenten und Skills werden installiert; aktive Charters stammen daraus und landen in `.squad/agents/`;
- ReqEng, Work und Review erscheinen jeweils nur einmal und werden nicht unter `.squad/001/` dupliziert.

An einer TTY denselben Installer ohne Modell-Flags starten. Pfeiltasten oder `j`/`k` bewegen, Enter bestätigt, Escape/`q` bricht ab; Zahlen wählen nicht. Ohne TTY müssen nicht-interaktive Flags verlangt werden. Projektfälle einzeln, mehrfach und null prüfen; Owner wird aus `{owner}` abgeleitet. Ein Launcher mit `--model` muss den Override unverändert weitergeben.

Danach:

```bash
node .squad/templates/squad-heroes/companion/scripts/install \
  --target {snake-dir} \
  --repository {owner}/squad-heroes-snake \
  --project-type 001 \
  --deployment-branches 1 \
  --deployment-branch-1 main \
  --language de \
  --model-reqeng mai-code-2 \
  --model-work claude-sonnet-5.5 \
  --model-review gpt-6.1-terra
git status --short
find scripts .github/prompts .github/workflows .squad/agents -type f -print
node scripts/start-reqeng.mjs --help
node scripts/start-work.mjs --help
node scripts/start-review.mjs --help
node scripts/update-badges.mjs --check
node scripts/versionbump.mjs --help
node scripts/check-release-label.mjs --help
```

Gate: alle Einstiegspunkte existieren und liefern sichere Hilfe/Diagnose. Derselbe Apply erneut meldet `changed: 0`. Ändere einen verwalteten Markerblock: Dry-run zeigt lokale, eingehende und Ergebnisfassung; ungeklärte Konflikte schreiben nichts. Nur eine dokumentierte Entscheidung wird angewendet. `history.md` wächst nur append-only; Profilwechsel stoppt fail-closed.

Nach Plugin-Update Companion erneut ausführen. Aktive Bytes dürfen sich nur bei diesem Apply ändern. Plugin deaktivieren/deinstallieren: aktive Dateien bleiben bestehen und `.squad/plugins/*` blieb beim Companion-Rerun unverändert. Danach neu installieren.

## Snake-Issue anlegen

Die bereitgestellte [Issue-Vorlage](testplan-snake-issue.md) direkt verwenden; keine lokale Issue-Datei erzeugen:

```bash
cd {snake-dir}
gh issue create --repo github.com/{owner}/squad-heroes-snake \
  --title "Build browser-based Snake game" \
  --body-file {heroes-dir}/docs/de/testplan-snake-issue.md
gh issue list --repo github.com:{owner}/squad-heroes-snake --state open
```

Die ausgegebene URL/Nummer unmittelbar als `{snake-issue}` erfassen. Gate: genau ein neues, offenes Ticket; fremde Tickets bleiben unverändert.

## Squad-Flows prüfen

```bash
cd {snake-dir}
node scripts/start-reqeng.mjs --issue {snake-issue}
node scripts/start-work.mjs --issue {snake-issue}
git branch --show-current
git worktree list
git log --oneline -5
gh issue view {snake-issue} --repo github.com:{owner}/squad-heroes-snake
```

Gate: Blocking-Fragen sind vor Work geschlossen, derselbe Frageblock wird ohne Duplikate ausgewertet und genau eine validierte Modell-ID wird unverändert weitergegeben. Branch, Issue-Referenz und tmux/Worktree sind eindeutig.

Implementieren, prüfen und mit `gh pr create` übergeben. Die PR muss `Closes #{snake-issue}` enthalten.

```bash
gh pr view --repo github.com:{owner}/squad-heroes-snake
gh pr checks --repo github.com:{owner}/squad-heroes-snake --watch --fail-fast
gh pr view --repo github.com:{owner}/squad-heroes-snake \
  --json reviewDecision,mergeable,state
node scripts/start-review.mjs --pr {snake-pr}
```

Gate: Review-Baseline ist Run-Override, konfigurierte Baseline oder PR-Base, nie Head. Bei Fehler, fehlender Freigabe oder offenem Gate weder Ready noch Merge. Nach Freigabe mergen und Abschluss mit Test- und Commit-Evidenz kommentieren.

## Snake-Verhalten prüfen

```bash
cd {snake-dir}
npm ci
npm test
npm run build
npm run check
```

Automatischer Gate:

- fixer Seed ergibt denselben Start- und Endzustand;
- Bewegung ist nur achsenparallel, direkte Umkehr blockiert;
- Nahrung belegt freie Zellen und erhöht Länge/Score;
- Wand- und Selbstkollision ergeben Game Over;
- Restart stellt den Startzustand her und erzeugt keine zweite Schleife;
- identische Aktionen erzeugen identischen Zustand.

Manuell Desktop und schmale Viewport-Größe prüfen: Serverstart aus der erzeugten README, Tastatur/optionale Touchsteuerung, Fokus, Wachstum, Score, Game Over, Restart, kein Overflow, keine Konsolen- oder Netzfehler. Browser, Version, Zeit und Screenshots dokumentieren.

## Project-Erstellung prüfen

Fixture: Owner `frickeldave-test`, Repository `squad-heroes-snake`, null Projects.

```bash
node .squad/templates/squad-heroes/companion/scripts/install \
  --target "$PWD" \
  --repository frickeldave-test/squad-heroes-snake \
  --enable-board-sync \
  --project-type 001 \
  --language de \
  --deployment-branches 1 \
  --deployment-branch-1 main \
  --model-reqeng mai-code-2 \
  --model-work claude-sonnet-5.5 \
  --model-review gpt-6.1-terra \
  --create-project \
  --project-title squad-heroes-snake \
  --dry-run
```

Gate: Menü enthält Companion-Anlage, manuelle Anlage und Abbruch; Dry-run zeigt `PLANNED_CREATE` und `{{PROJECT_NUMBER}}`, führt aber keine Mutation oder Platzhalter-Abfrage aus. Apply erzeugt genau einmal, löst echte Nummer/Node-ID auf, prüft `viewerCanUpdate`, richtet Schema und Repository-Link ein und speichert die Nummer. Rerun erzeugt weder ein zweites Project noch lokale Writes. Fehler bei 403, fehlenden CI-Flags, ungültigem Titel oder Teilschema liefern sichere Recovery ohne Secret. `HEROES_PROJECT_TOKEN` wird nur für Project v2 verwendet; Repository-Zugriffe nutzen `${{ github.token }}`.

## Veraltete Consumer-Kopie

```bash
git -C {heroes-dir} pull --ff-only
squad plugin install {heroes-dir}
squad plugin verify
sha256sum {heroes-dir}/dist/companion/scripts/install
sha256sum .squad/templates/squad-heroes/companion/scripts/install
cmp {heroes-dir}/dist/companion/scripts/install \
  .squad/templates/squad-heroes/companion/scripts/install
node .squad/templates/squad-heroes/companion/scripts/install --target "$PWD" --dry-run
```

Gate: `cmp` endet mit 0.

## Abbruch und Cleanup

Bei Fehler laufende Prozesse stoppen und Schritt, Command, Exitcode sowie letzte bestandene Prüfung festhalten. Nichts mutieren, wenn Eigentum eines Ressourcen-Namens unklar ist. Bei Project-Teilfehler zuerst `gh project list --owner {owner} --limit 100 --format json` und vorhandenen Zustand prüfen; nicht blind neu anlegen.

```bash
cd {snake-dir}
git worktree list
gh pr list --repo github.com:{owner}/squad-heroes-snake --state open
gh issue list --repo github.com:{owner}/squad-heroes-snake --state open
```

- Nur eigene Worktrees mit `git worktree remove {path}` entfernen.
- Eigene tmux-Sitzungen exakt mit `tmux kill-session -t {name}` beenden.
- Testbranches nur nach finalem Commit und mit expliziter Bestätigung löschen.
- Evidenz nach Aufbewahrungsregel ablegen.
- Das Testrepo nur nach ausdrücklicher menschlicher Freigabe löschen:

```bash
gh repo delete github.com/{owner}/squad-heroes-snake --yes
```

- `gh auth status` erneut prüfen; den Credential-Store nicht verändern.

Finale Evidenz: Commit-ID, Prüfsummen, `list --json`, Plans, Issue/PR, Checks, Review, Modell/Scribe, Browserdaten und Cleanup.
