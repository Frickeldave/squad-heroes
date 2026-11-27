# Sicherheit und Ownership

## Schreibgrenzen

- Plugin-Lifecycle: ausschließlich `.squad/plugins/*` durch Squad.
- Plugin-Inhalte: ausschließlich die statische Distribution unter
  `.squad/templates/squad-heroes/companion/`.
- Companion: ausschließlich explizit katalogisierte aktive Ziele.
- Prompt-Layer: ausschließlich `.github/prompts/addon.config.json`.

Dieselben Ziele werden nie parallel besessen. Plugin-Lifecycle-Befehle verändern
keine aktiven Companion-Dateien; der Companion nutzt die installierte
Distribution und verändert sein Plugin-verwaltetes Bundle selbst nicht.

## Rechte und Zustimmung

Vor Mutation sind `gh auth status` und Push-Recht Pflicht. Zusätzlich muss jede
irreversible oder extern sichtbare Wirkung im Plan ausdrücklich freigegeben
werden. Berechtigung ersetzt keine Zustimmung. Dieser MVP-Installer führt
keine realen Board-, Release- oder Deployment-Writes aus.

## Konflikte

Bestehende verwaltete Bereiche zeigen Basis, lokalen Stand, eingehende Fassung
und Ergebnis. Zulässig sind ausschließlich `verwenden`, `behalten`,
`zusammenführen`, `abbrechen`. Ein Merge wird erneut validiert. `history.md`
bleibt append-only; `team.md` ändert nur Markerbereiche.

## Credentials

Tokens und PATs werden weder abgefragt noch als Argument, stdin, Datei, Log oder
Test-Fixture akzeptiert. Zulässig sind nur der sichere Host-Credential-Store und
der offizielle Browser-/Device-Flow.
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
