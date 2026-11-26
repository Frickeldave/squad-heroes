# Workflows und Automatisierung

Der Companion verteilt fünf strikt getrennte Consumer-Vorlagen:

- `heroes-ci.yml`: durch Branch-Strategie gerenderte CI.
- `heroes-configure.yml`: Roster-Labels und optionales initiales Project-Schema.
- `heroes-release-label.yml`: read-only Label-/Versions-Gate.
- `heroes-update-badges.yml`: einzelner README-Markerblock, Bot-/Skip-/Stale-Schutz.
- `heroes-sync-project-board.yml`: optionaler Lifecycle-Sync nach vollständigem Opt-in.

Alle Vorlagen laufen auf `ubuntu-latest` mit Minimalpermissions. CRAFT-Owner,
Repository, Project, Runner, Status, Branches, Badge-Quellen und Release-Linie
sind keine Defaults.

## README-Badges

`update-badges.mjs --check` meldet Drift ohne Write. Der Generator ersetzt nur
einen eindeutigen Markerblock und lässt alles außerhalb bytegenau. Gleiches
Ergebnis erzeugt weder Write noch Commit noch Push.

## Version und Release-Label

`versionbump` akzeptiert nur striktes `X.Y.Z`, ändert konfigurierte
Package-Dateien, aber commitet, pusht oder deployed nicht. Das Release-Gate ist
read-only und verlangt genau ein positives oder negatives konfiguriertes Label.

## ReqEng und Ralph

Manuelles ReqEng erstellt keinen Issue-Kommentar. Der Ralph-Modus verwendet
genau einen Block zwischen `<!-- squad:reqeng-questions -->` und
`<!-- /squad:reqeng-questions -->`, wartet mit offenen Blocking-Fragen und
wertet gesammelte Antworten nur gegen aktuell angezeigte Optionen aus.
