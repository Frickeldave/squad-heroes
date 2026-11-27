# Installation

## Architektur

Das Plugin besitzt nur versionierte, statische Dateien unter `.squad/heroes/`.
Der Companion besitzt ausschließlich materialisierte aktive Ziele wie Agenten,
`.github/prompts/`, Workflows und Skripte. Squad `.squad/plugins/*` bleibt die
einzige Quelle für den Plugin-Lifecycle.

Agent-/Prompt-Quellen, Companion-Adapter, Launcher/Automatisierung sowie
Dokumentation/Qualität sind vier Bestandteile desselben Overlays und werden
zusammen versioniert; es gibt keine vier separaten Installationsprodukte.

## Vorprüfung

Der Installer liest vor jeder Planung und unmittelbar vor dem ersten Write den
Marker aus `.github/agents/squad.agent.md`. Genau ein gültiger stabiler
SemVer-Marker ab `2.0.0` ist erlaubt, also auch `2.0.1` oder `3.0.0`.
Build-Metadaten beeinflussen die Rangfolge nicht; Prerelease-Marker werden
abgewiesen. Andernfalls endet der Lauf mit Exit-Code 2 und der Meldung
`ERROR: squad-heroes minimum Squad version 2.0.0 is required; detected
"<value|missing|multiple|invalid>". Installation aborted before mutation.`
Ohne Backup, Journal, Lock oder Teilinstallation.

Die Diagnose weist an, `squad upgrade --self` als normaler Benutzer
auszuführen, bei Bedarf eine root-eigene globale npm-Installation zu reparieren
und danach das Ziel-Repository zu aktualisieren. Squad selbst darf dafür nicht
unter `sudo` laufen.

Danach läuft `gh auth status` und eine nicht mutierende Repository-Abfrage. Bei
Fehlern wird ausschließlich zum hostseitigen `gh auth login` verwiesen.

## Erstinstallation

Es gibt zwei getrennte, read-only Dry-runs. `squad plugin dry-run` plant nur die
statischen Marketplace-Templates. `scripts/install.mjs --dry-run` plant die
aktiven Companion-Ziele, darunter `scripts/`, `.github/prompts/`, Workflows und
materialisierte Agent-Dateien. Vor einer Installation müssen beide Pläne
geprüft werden; der Plugin-Dry-run ist nicht der vollständige Lieferplan.

```bash
git clone https://github.com/Frickeldave/squad-heroes.git
cd /repo
node /pfad/zum/squad-heroes/scripts/plugin-preflight.mjs --target "$PWD"
squad plugin validate /pfad/zum/squad-heroes
# Nur statische Plugin-Ziele:
squad plugin dry-run /pfad/zum/squad-heroes
node /pfad/zum/squad-heroes/scripts/install.mjs \
  --target "$PWD" --repository owner/repository \
  --profile typescript-development \
  --deployment-branches 1 --deployment-branch-1 prd \
  --language de --dry-run
node /pfad/zum/squad-heroes/scripts/plugin-preflight.mjs --target "$PWD"
squad plugin install /pfad/zum/squad-heroes
squad plugin enable squad-heroes
squad plugin list --json
squad plugin verify
```

`plugin-preflight.mjs` ist nur ein read-only Kompatibilitäts- und
Manifest-Gate; es installiert nichts und besitzt keinen Plugin-Lifecycle.
Die zweimalige Prüfung belegt frühe und letzte Prüfung vor dem realen
Squad-Befehl. `squad plugin install <local-dir>` ist der einzige
Plugin-Installationsweg.

Der zweite Dry-run muss aktive Ziele wie `scripts/start-work.mjs` und
`.github/workflows/heroes-ci.yml` enthalten. Anschließend führt der Mensch
diesen bereits geplanten Companion-Befehl ohne `--dry-run` separat aus:

```bash
node scripts/install.mjs --target /repo --repository owner/repository \
  --profile typescript-development \
  --deployment-branches 1 --deployment-branch-1 prd \
  --language de --dry-run
```

`TypeScript Development` ist das einzige MVP-Profil. Es installiert Tony,
Pepper, Bruce, Clint, Maria, Natasha und Nick. `Client` wird nicht verwendet.
Beide Sprachvarianten werden immer materialisiert; `--language` steuert nur die
aktive `charter.md` und die aktuelle Ausgabe.

Fehlende, doppelte oder mehrdeutige Branch-Eingaben stoppen vor dem ersten Write.

## Root-eigene globale Squad-Installation reparieren

`squad upgrade --self` wird zuerst als normaler Benutzer ausgeführt. Meldet npm
bei einem root-eigenen globalen Paket `EACCES` oder `EPERM` beim Umbenennen, darf
die CLI nicht unter `sudo` erneut gestartet werden. Bei npm mit
`--allow-scripts` wird die globale Installation einmal mit der verifizierten,
befehlslokalen Allowlist repariert:

```bash
sudo sh -c 'umask 022 && exec npm install -g --allow-scripts=@bradygaster/squad-cli,node-pty,koffi,protobufjs @bradygaster/squad-cli@latest'
```

Das explizite `umask 022` ist erforderlich: Eine geerbte restriktive umask kann
Paket und Launcher-Ziel als nur für den Besitzer ausführbar (`750`) neu
erzeugen. Dadurch kann `/usr/bin/squad` für root funktionieren, während normale
Benutzer `Permission denied` erhalten. Die Allowlist umfasst genau die vier
Pakete dieses Abhängigkeitsbaums mit Install-Skripten
(`@bradygaster/squad-cli`, `node-pty`, `koffi` und `protobufjs`) und verändert
keine dauerhafte globale npm-Richtlinie.

Danach das Terminal oder die Shell neu starten und vor jedem Projekt-Upgrade den
reparierten Launcher prüfen:

```bash
command -v squad
ls -l "$(command -v squad)"
squad --version
```

Erst wenn diese Befehle erfolgreich sind, im Ziel-Repository `squad upgrade`
ausführen und prüfen, dass genau ein stabiler SemVer-Marker ab `2.0.0`
vorhanden bleibt. Für `Permission denied` niemals ein rekursives `chmod` auf dem
globalen npm-Verzeichnis oder `--dangerously-allow-all-scripts` verwenden.
Symlink mit `ls -l` prüfen, dann den Reparaturbefehl mit expliziter `umask`
wiederholen; keine Dateirechte von einzelnen Abhängigkeiten erraten.

## Aktualisierung

Der installierte Squad CLI hat kein `plugin update`. Für ein Update wird der
neue Checkout validiert und erneut mit `squad plugin install` installiert:

```bash
squad plugin verify &&
squad plugin install /pfad/zum/aktuelleren/squad-heroes &&
squad plugin verify
squad plugin list --json
```

`verify` vor `install` verhindert, dass eine lokale Änderung an Squad-eigenen
Zielen still von einem Update überschrieben wird. Squad verwaltet Version,
Manifest- und Dateiprüfsummen unter `.squad/plugins/*`; ein neuer Source,
Manifest, Checkout oder Prüfsummenstand wird dort beim erneuten `install`
registriert. Die Companion-Dateien bleiben davon unberührt. Ein erneutes
`install` derselben Quelle ist idempotent in den gelieferten Zielen, auch wenn
Squad neue Installationszeitstempel/Audit-Ereignisse schreibt.

`.squad/heroes.json` hält die einmalige Profilidentität. Ein Profilwechsel
erfordert Uninstall/Reinstall. Bestehende Charters, Team-Bereiche und Workflows
werden nur in markierten Bereichen geändert; lokale Bytes bleiben erhalten.
