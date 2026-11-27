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
- `gh_host`: `gh` auf dem Host installieren und dort anmelden.
- `gh_auth`: auf dem Host den offiziellen `gh auth login`-Browser-/Device-Flow
  ausführen.
- `gh_permission`: Repository-Lese- oder Push-Recht nicht beweisbar; Zugriff
  bestätigen oder vom Owner anfordern.
- `gh_project`, `project_missing`, `project_ambiguous`: Project-Scopes/Zugriff
  oder deterministische Auswahl fehlen. Host-Auth mit `read:project,project`
  erneuern, Account-Zugriff bestätigen, ein Project anlegen/freigeben oder für CI
  eine validierte `--project-number` übergeben.
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
