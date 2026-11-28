# Sicherheit und Ownership

## Schreibgrenzen

- Squad besitzt nur `.squad/plugins/*`.
- Das Plugin besitzt die Distribution unter `.squad/templates/squad-heroes/companion/`.
- Der Companion besitzt nur explizit katalogisierte aktive Ziele.
- Profilquellen gehören zu `.squad/001/`; aktive Agenten werden nach `.squad/agents/` materialisiert.
- Prompt-Layer stammen ausschließlich aus `.github/prompts/addon.config.json`.

Plugin-Befehle ändern keine aktiven Companion-Dateien. Der Companion ändert sein Plugin-Bundle nicht. Dieselbe Datei gehört nie zwei Ownern gleichzeitig.

## Freigaben

Vor Planung sind Host-Authentifizierung, Account, Repository-Zugriff und nicht-mutierender Project-API-Zugriff Pflicht. Der schreibfähige `project`-Scope wird aus gefilterter Ausgabe geprüft; gespeichert werden nur sichere Scope-/Permission-Booleans.

Dry-run und Erstaktivierung schreiben kein Project. Board-Mutation erfordert Opt-in und frische Prüfung von `viewerCanUpdate`; Project-Anlage benötigt Planfreigabe, in CI `--create-project` und im Terminal zusätzlich `y/N`.

## Konflikte

Aktive Konflikte zeigen Basis, lokalen Stand, eingehende Fassung und Ergebnis. Erlaubt sind nur `use`, `keep`, `merge` und `abort`. Merge wird erneut validiert; `history.md` bleibt append-only. Ungeklärte Konflikte stoppen vor Writes.

## Credentials

Tokens und PATs werden weder erfragt noch als Argument, stdin, Fixture, Datei oder Log akzeptiert. Unterstützt sind Host-Credential-Store und offizielle Browser-/Device-Flows. `--with-token`, Token-Umgebungswerte und ausgegebene Header sind unzulässig.

Project-Workflows benötigen den festen Secret-Ausdruck `secrets.HEROES_PROJECT_TOKEN`, weil `github.token` keine GitHub-Projects-v2-Owner-Rechte erhält. Der PAT braucht nur `project` beziehungsweise fein abgestuftes Projects-Lese-/Schreibrecht; `repo` ist nicht nötig. Repository-Issue-/PR-Zugriffe bleiben bei `${{ github.token }}`. Kein Tokenwert wird gelesen, in `.squad/heroes.json` gespeichert oder protokolliert.

## Project-Anlage

Apply erstellt das Project erst nach lokalen Konfliktprüfungen. Es löst die echte Nummer auf, prüft `viewerCanUpdate`, konfiguriert Schema/Link und speichert die Nummer. Teilfehler können externen Zustand hinterlassen; es gibt kein globales Rollback. Recovery nutzt sichtbare Project-Listen statt blinder Wiederholung.

## Supply Chain

Vertrauensstufe: `source trust: moderate`. Version, Release/Commit und verfügbare Hashes werden geprüft. Das Produkt behauptet keine eigene PKI-, Zertifikats- oder Signaturinfrastruktur.
