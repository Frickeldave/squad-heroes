# Sicherheit und Ownership

## Schreibgrenzen

- Plugin-Lifecycle: ausschließlich `.squad/plugins/*` durch Squad.
- Plugin-Inhalte: die vollständige versionierte Distribution unter
  `.squad/templates/squad-heroes/companion/`, einschließlich statischer Kopien
  von Installer, Laufzeit, Skripten, `.squad/heroes/`, Workflows, Ressourcen und
  Humanizer-Dateien.
- Companion: explizit katalogisierte aktive Consumer-Ziele in seinem separaten
  Aktivierungsplan.
- Prompt-Layer: ausschließlich `.github/prompts/addon.config.json`.

Dieselben Ziele werden nie parallel besessen. Der Plugin-Distributionsplan
zielt nicht direkt auf Root-`scripts/`, `.github/prompts/` oder
`.github/workflows/`. Plugin-Lifecycle-Befehle verändern keine aktiven
Companion-Dateien; der Companion nutzt die installierte Distribution und
verändert sein Plugin-verwaltetes Bundle selbst nicht.

## Rechte und Zustimmung

Vor Planung sind `gh auth status --hostname github.com`, authentifizierter
Account-Zugriff und `gh api repos/OWNER/REPO --jq .permissions` Pflicht.
Die Scope-Zeile des aktiven Accounts muss den schreibfähigen Scope `project`
gewähren; gespeichert wird nur ein gefilterter Scope-Status. Gespeichert werden
außerdem nur die Booleans read/push/admin/triage. Jede vollständige Installation
einschließlich Dry-run verlangt nicht-mutierenden Project-API-Zugriff; der
Owner wird aus dem Repository abgeleitet. Host-Fehler verweisen auf
`gh auth login --hostname github.com --web`. Fehlender Scope wird exakt mit
`gh auth refresh -h github.com -s project` und anschließend
`gh auth status --hostname github.com` behoben. `read:project` reicht technisch
nur für isolierte Metadaten-Lesevorgänge, nicht für dieses Board-Setup, das
Project-Felder, Status und Schema ändert. Berechtigung ersetzt
keine ausdrückliche Zustimmung. Dry-run und Erstaktivierung schreiben kein
Project; der spätere Workflow bleibt separat opt-in.

## Konflikte

Bestehende verwaltete Bereiche zeigen Basis, lokalen Stand, eingehende Fassung
und Ergebnis. Zulässig sind ausschließlich `verwenden`, `behalten`,
`zusammenführen`, `abbrechen`. Ein Merge wird erneut validiert. `history.md`
bleibt append-only; `team.md` ändert nur Markerbereiche.

## Credentials

Tokens und PATs werden weder abgefragt noch als Argument, stdin, Datei, Log oder
Test-Fixture akzeptiert. Zulässig sind nur der sichere Host-Credential-Store und
der offizielle Browser-/Device-Flow. `--with-token`, Token-Umgebungsvariablen,
Token-Argumente und ausgegebene Credentials werden nicht verwendet.
Bei einer nicht unterstützten Squad-Version wird `squad upgrade --self` als
normaler Benutzer und anschließend im Ziel-Repository `squad upgrade`
ausgeführt. Ein root-eigenes globales npm-Paket kann den einmaligen,
allowlist-beschränkten Reparaturbefehl aus der Installation erfordern; `sudo`
gilt nur für diesen npm-Installationsbefehl, niemals für Squad selbst. Kein
dieser Befehle erfordert, dass ein Token ins Terminal eingefügt wird.

## Supply-chain-Verifikation

Vertrauensstufe `source trust: moderate`: Release/Tag, Version/Commit und
vorhandene Upstream-Hashes werden geprüft. Das Projekt baut keine eigene PKI,
Zertifikats- oder Signaturinfrastruktur und erfindet keine Upstream-Garantie.
