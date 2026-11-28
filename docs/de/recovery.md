# Recovery und Troubleshooting

## Sicher stoppen und fortsetzen

Dateien werden einzeln atomar ersetzt; es gibt kein globales Rollback. Ein unterbrochener Lauf kann mit identischem Input wiederholt werden. Bestehende lokale Inhalte bleiben ohne bestätigte Entscheidung erhalten.

Bei jedem Fehler: aktive Commands/Jobs stoppen, Fehlertext und Exitcode sichern und keine weitere Ressource mutieren, sobald Ownership unklar ist.

## Plugin-Recovery

```bash
squad plugin verify
squad plugin list --json
```

Bei `checksum mismatch` nicht installieren. Konflikt behalten und den installierten Zustand bewusst wiederherstellen oder nach Review den kompletten Plugin-Stand neu installieren:

```bash
squad plugin install /pfad/zum/squad-heroes
squad plugin verify
```

Das stellt nur `.squad/templates/squad-heroes/companion/` wieder her. Root-`scripts/`, `.github/prompts/` und `.github/workflows/` werden davon nicht repariert; dafür den lokalen Companion getrennt im Dry-run und Apply ausführen.

Konflikte in Profilquellen `.squad/001/` werden wie aktive Companion-Ziele behandelt. Wiederhergestellte Agenten und Skills müssen aus diesen Quellen erneut materialisiert werden.

## Companion-Konflikte

Ungeklärte Konflikte stoppen vor Writes. Die normale TTY-Ansicht erklärt Ziel, vorgeschlagene Änderung und Empfehlung in natürlicher Sprache. Bei verwalteten Abschnitten ist Zusammenführen vorausgewählt. `Details / Diff anzeigen` ist optional und begrenzt. Nutzer müssen weder `owner`, `actionDetails`, maskierte Dateiinhalte noch rohes Plan-JSON interpretieren.

TTY-Auswahl: Pfeile oder `j`/`k`, Enter, Escape/`q`. CI verwendet interne Entscheidungswerte in einer Datei:

```json
{
  ".squad/team.md": "use",
  ".github/workflows/heroes-ci.yml": "merge"
}
```

```bash
node .squad/templates/squad-heroes/companion/scripts/install \
  --target "$PWD" \
  --decisions .squad/heroes-decisions.json \
  --dry-run
```

Apply speichert die bestätigte Map in `.squad/heroes.json`. `merge` wird erneut auf Marker und UTF-8 geprüft; `history.md` bleibt append-only.

## Fehlercodes

| Fehler | Recovery |
| --- | --- |
| `detected "missing"`, duplizierter/ungültiger Marker, Prerelease oder Version unter 2.0.0 | Ohne Mutation stoppen; Squad normal upgraden und Marker erneut prüfen. |
| `gh_cli_missing` | `gh` installieren und offiziellen Login verwenden. |
| `gh_auth_failed` | `gh auth login --hostname github.com --web`; keinen Token einfügen. |
| `gh_repository_not_found` | Owner/Repo, Sichtbarkeit und privaten Zugriff prüfen. |
| `gh_repository_read_denied` / `push_denied` | Owner um Read-/Collaborator- oder Write-Zugriff bitten. |
| `gh_account_mismatch` | Mit `gh auth switch` einen vorhandenen Account wählen oder den offiziellen Login starten. |
| `gh_api_error` | GitHub, VPN, DNS und Netzwerk prüfen, dann erneut versuchen. |
| `gh_project_scope`, `project_access`, `project_missing`, `project_ambiguous` | Scope erneuern, Auswahl prüfen oder validierte Project-Nummer angeben. |
| `conflicts` / `ambiguous_markers` | Dry-run und Marker prüfen; Entscheidung erforderlich. |
| `deployment_branch` | Ref und Branch-Angabe korrigieren. |
| `model_default` | Explizite Flow-Modell-ID angeben. |

## GitHub-Preflight

```bash
gh auth status --hostname github.com
gh api user --jq .login
gh api repos/OWNER/REPO --jq .permissions
gh repo view OWNER/REPO
```

- 404: Slug falsch oder privates Repository unsichtbar; Owner muss Zugriff gewähren.
- `read: true`, `push: false`: Repository ist sichtbar, Write fehlt. Owner muss Collaborator-Zugriff geben; Owner-Gleichheit ist nicht erforderlich.
- Richtiges Konto: `gh auth switch --hostname github.com --user ACCOUNT`.
- Fehlender `project`-Scope:

```bash
gh auth refresh -h github.com -s project
gh auth status --hostname github.com
```

Fehlermeldungen nennen nur sicheren Login, Host, Slug und gefiltertes Ergebnis: **Keine Mutation gestartet**. Keine Tokens oder Authorization-Header kopieren.

## Project-Teilzustand

Project-Erstellung ist extern sichtbar und wird nicht global zurückgerollt. Bei Fehler vor der Standortprüfung oder Schema/Link:

```bash
gh project list --owner OWNER --limit 100 --format json
```

Vorhandene Nummer, Titel, Schema und Repository-Link prüfen. Danach mit bestätigter `--project-number` erneut ausführen; nicht blind neu anlegen. Erfolgreicher State speichert die reale Nummer und Recovery-Baselines in `.squad/heroes.json`.

## Squad-Launcher

Bei `Permission denied` Symlink und Ziel dokumentieren. Als normaler Benutzer `squad upgrade --self` ausführen; nur bei root-eigenem npm-Paket den begrenzten Reparaturbefehl aus [Installation](installation.md#squad-launcher-reparieren) nutzen. Danach Launcher prüfen und den Terminalprozess neu starten:

```bash
command -v squad
ls -l "$(command -v squad)"
squad --version
```

Danach erst im Consumer `squad upgrade` ausführen. Kein rekursives `chmod`, kein `sudo squad`.
