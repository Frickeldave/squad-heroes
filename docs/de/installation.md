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
Marker aus `.github/agents/squad.agent.md`. Genau eine syntaktische Version
`2.0.0` ist erlaubt. Andernfalls endet der Lauf mit Exit-Code 2 und exakt der
Meldung `ERROR: squad-heroes requires Squad 2.0.0 exactly; detected
"<value|missing|multiple|invalid>". Installation aborted before mutation.`
Ohne Backup, Journal, Lock oder Teilinstallation.

Danach läuft `gh auth status` und eine nicht mutierende Repository-Abfrage. Bei
Fehlern wird ausschließlich zum hostseitigen `gh auth login` verwiesen.

## Erstinstallation

```bash
git clone https://github.com/Frickeldave/squad-heroes.git
cd /repo
node /pfad/zum/squad-heroes/scripts/plugin-preflight.mjs --target "$PWD"
squad plugin validate /pfad/zum/squad-heroes
squad plugin dry-run /pfad/zum/squad-heroes
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

Anschließend führt der Mensch den Companion separat aus:

```bash
node scripts/install.mjs --target /repo --repository owner/repository \
  --deployment-branches 1 --deployment-branch-1 prd \
  --language de --dry-run
```

`TypeScript Development` ist das einzige MVP-Profil. Es installiert Tony,
Pepper, Bruce, Clint, Maria, Natasha und Nick. `Client` wird nicht verwendet.
Beide Sprachvarianten werden immer materialisiert; `--language` steuert nur die
aktive `charter.md` und die aktuelle Ausgabe.

Fehlende, doppelte oder mehrdeutige Branch-Eingaben stoppen vor dem ersten Write.

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
