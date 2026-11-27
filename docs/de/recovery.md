# Recovery und Troubleshooting

## Kein globales Rollback

Der Installer tauscht einzelne Dateien atomar im Dateisystem aus, behauptet aber
keine globale Mehrdateien-Transaktion. Ein Plan ist idempotent und ein
unterbrochener Lauf lässt sich mit gleichem Input fortsetzen. Vorhandene lokale
Dateien bleiben erhalten, sofern kein bestätigter verwalteter Bereich geändert wird.

## Konflikt auflösen

Bei Plugin-Artefakten wird zuerst `squad plugin verify` ausgeführt. Ein
Prüfsummenfehler stoppt die dokumentierte Update-Kette vor
`squad plugin install <neuer-local-dir>`; Squad selbst bietet keine automatische
3-Way-Zusammenführung für Plugin-Dateien. Der Konflikt wird bewusst behalten,
der installierte Zustand wiederhergestellt oder nach dokumentiertem Einverständnis
neu installiert. `verify` und `list --json` liefern den nachweisbaren aktuellen
Stand. Dieser Konfliktschutz gilt nur für Squad-eigene Plugin-Ziele.

Korrupte Dateien unter `.squad/templates/squad-heroes/companion/` werden nach
`verify` über `squad plugin install` als vollständige Plugin-Distribution
wiederhergestellt. Dabei werden Root-`scripts/`, `.github/prompts/` und
`.github/workflows/` nie direkt installiert oder repariert. Dafür den kopierten
Companion separat erneut ausführen und seinen Aktivierungsplan prüfen. Ein
Plugin-Uninstall lässt aktive Ziele und `.squad/heroes.json` absichtlich
bestehen.

Der `--dry-run` des kopierten Companions zeigt alle aktiven Operationen und
Konflikte. Entscheidungen werden in einer JSON-Datei je aktivem Zielpfad
dokumentiert und mit `--decisions` übergeben:

```json
{
  ".squad/team.md": "use",
  ".github/workflows/heroes-ci.yml": "merge"
}
```

Erlaubt sind `use`, `keep`, `merge`, `abort` (deutsche Entsprechungen:
verwenden, behalten, zusammenführen, abbrechen). `merge` wird vor dem Write
erneut auf Marker und UTF-8 validiert.

## Typische Fehler

- `detected "missing"`: Markerdatei oder Marker fehlt.
- `detected "0.13.1"` oder eine andere niedrigere Version: Exit-Code 2. Ohne
  Mutation stoppen und `squad upgrade --self` als normaler Benutzer ausführen.
  Bei `EACCES`/`EPERM` einer root-eigenen globalen npm-Installation den
  sicheren Reparaturbefehl unter
  [Installation](installation.md#root-eigene-globale-squad-installation-reparieren)
  nutzen; Squad selbst nicht unter `sudo` starten.
- Exit-Code 2 gilt ebenso für fehlende, doppelte, ungültige oder Prerelease-
  Squad-Versionen; `2.0.0-rc.1` wird nicht akzeptiert.
- `gh_cli_missing`: `gh` installieren und dann über Browser/Device anmelden.
- `gh_auth_failed`: den Host-Browser-/Device-Flow verwenden; keinen Token
  einfügen.
- `gh_repository_not_found`: falscher Slug, fehlendes Repository oder ein
  privates Repository, das der aktive Account nicht sieht.
- `gh_repository_read_denied`: einen Owner um Lese-/Collaborator-Zugriff bitten.
- `gh_repository_push_denied`: lesbar, aber ein Owner/Maintainer muss Write-
  oder Collaborator-Zugriff gewähren.
- `gh_account_mismatch`: nur zu einem bereits eingerichteten Account wechseln,
  sonst per Browser/Device anmelden und Identität auswählen.
- `gh_api_error`: erneut versuchen und Host, VPN, DNS sowie GitHub-Verfügbarkeit
  prüfen.
- `gh_project_scope`/`gh_project_access`, `project_missing`,
  `project_ambiguous`: schreibfähiger `project`-Scope, Project-API-Zugriff oder
  deterministische Auswahl fehlt. Ausschließlich mit
  `gh auth refresh -h github.com -s project` erneuern und mit
  `gh auth status --hostname github.com` prüfen; im Companion mit `--create-project --project-title` anlegen oder für ein vorhandenes Project eine validierte `--project-number` übergeben. 403 bedeutet
  Project-/Organizationsrechte, 404 falschen, privaten oder unsichtbaren
  Owner/Project-Kontext.
- Null-Project-Menü: „Project manuell anlegen“ oder Abbrechen ausgeben lassen;
  die Meldung benennt Owner, vorgeschlagenen Titel, den aktiven Account sowie
  die verifizierte CLI/GitHub-UI-Erstellung. `gh project list --owner
  frickeldave-test --limit 100 --format json` prüft Nummer und Sichtbarkeit;
  danach den Companion mit `--project-number <number>` ausführen oder im
  Pfeiltastenmenü wählen. Dry-run erzeugt kein Project.
- `conflicts`: Dry-run und Dateien unverändert; Entscheidung erforderlich.
- `ambiguous_markers`: doppelte, fehlende oder vertauschte Marker.
- `deployment_branch`: Ref ungültig oder nicht eindeutig.
- `model_default`: explizite Flow-Modell-ID fehlt.
- `Plugin verification failed: checksum mismatch ...`: lokale Änderung an
  einem Squad-eigenen Plugin-Ziel; `install` nicht ausführen.
- `Permission denied` beim Auflösen oder Ausführen von `squad`: nach der
  globalen Reparatur Terminal neu starten und `command -v squad`,
  `ls -l "$(command -v squad)"` sowie `squad --version` prüfen. Nicht
  rekursiv am globalen npm-Baum `chmod` ausführen. Erst nach erfolgreicher
  Prüfung im Ziel-Repository `squad upgrade` starten und den Marker prüfen.

Bei Authentifizierungsfehlern nur offizielle Host-Flows `gh auth login` oder
`gh auth refresh` nutzen. Tokens nicht kopieren, nicht mit `--with-token`
übergeben und keine Token-Werte im Terminal eingeben.

## GitHub-Preflight-Korrekturen zum Kopieren

Jeder Fehler meldet Host, sicheren aktiven Login, Repository-Slug, bereinigtes
Prüfergebnis und **Keine Mutation gestartet**. Tokens, Header und vollständige
API-Antworten werden nie ausgegeben.

```sh
gh auth status --hostname github.com
gh api user --jq .login
gh api repos/OWNER/REPO --jq .permissions
gh repo view OWNER/REPO
```

- `404`: Owner/Name ist falsch oder der Account sieht das private Repository
  nicht. Ein authentifizierter Owner prüft Existenz und gewährt
  Collaborator-Zugriff.
- Antwort mit `read: true` und `push: false`: kein Owner-Identitätsfehler.
  Owner/Maintainer um Write-/Collaborator-Zugriff bitten und Login mit
  `gh api user --jq .login` prüfen. Der Account muss nicht Owner sein.
- Fehlende/fehlgeschlagene Host-Anmeldung:
  `gh auth login --hostname github.com --web`.
- Ist der richtige Account schon eingerichtet:
  `gh auth switch --hostname github.com --user ACCOUNT`. Sonst Browser-/Device-Login
  verwenden und diese Identität wählen. CI-/Operator-Läufe können bei bekannter
  Identität `--expected-github-account ACCOUNT` übergeben; Owner-Gleichheit wird
  niemals automatisch angenommen.
- Fehlender Project-Scope für Board-Setup (auch im Dry-run):
  `gh auth refresh -h github.com -s project`, danach
  `gh auth status --hostname github.com`.
- `read:project` allein unterstützt nur isolierte Project-Metadaten-Lesevorgänge.
  Es reicht absichtlich nicht aus, weil squad-heroes Felder, Status und Schema
  konfiguriert.
- Bei API-/Netzwerkfehlern nach Prüfung von `github.com`, VPN und DNS erneut
  versuchen. Keine Tokens, `Authorization`-Header oder Antwort-Bodies ausgeben.

## Recovery nach Project-Erstellung

Die Project-Erstellung ist extern sichtbar und wird nicht automatisch zurückgerollt. Bei Fehlern an Erstellung, Schreibzugriff, Schema oder Link kann das Project bereits bestehen beziehungsweise teilweise konfiguriert sein; kein lokaler State wurde geschrieben. Zuerst `gh project list --owner frickeldave-test --limit 100 --format json` prüfen, vorhandene State-Teile bewerten und nicht blind erneut anlegen. Beim Wiederholen wird das eine passende Project erkannt und wiederverwendet, nicht erneut angelegt. Danach werden Schema/Link erneut geprüft und nötige Änderungen nachgeholt. Titel und Project-Nummer vor dem Rerun verifizieren. Fertiger State enthält die reale Nummer und Recovery-Baselines in `.squad/heroes.json`. Fehler- und Recovery-Ausgaben enthalten keine Secret-Werte. `HEROES_PROJECT_TOKEN` erhält nur `project`; Repository-Vorgänge nutzen `github.token`.
