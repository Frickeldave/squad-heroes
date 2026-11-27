# squad-heroes

Ein marketplace-fähiges Squad-Overlay und ein separat versionierter, lokal
ausgeführter Companion für TypeScript-Projekte.

<!-- BEGIN GENERATED BADGES -->
[![Version](https://img.shields.io/badge/version-0.1.0-blue)](package.json)
<!-- END GENERATED BADGES -->

## Übersicht

Der Squad-Plugin-Lifecycle verwaltet **nur** die statische, versionierte
Distribution unter:

```text
.squad/templates/squad-heroes/companion/
```

`squad plugin install` kopiert diesen vollständigen Companion in das
Consumer-Repository. Dazu gehören Installer, Node-Laufzeitmodule, Katalog,
Profile, Agenten, Prompts, Workflows, Templates, Ressourcen und die
zweisprachigen Humanizer-Dateien. Der Plugin-Install schreibt oder startet
nichts Aktives; insbesondere führt er den Companion nicht automatisch aus.
Der unterstützte Befehl ist `squad plugin install <local-dir>`.

Squad 2.0.0 lehnt ausführbare Dateiendungen in statischen Plugin-Manifesten
ab. Deshalb liegen die JavaScript-Module im verwalteten Bundle ohne Endung;
`node` erkennt sie durch das mitgelieferte `type: module` als ESM. Beim
Companion-Lauf werden aktive Consumer-Skripte wieder als `.mjs` materialisiert.

## Schnellstart

Vom Zielrepository aus:

```bash
git clone https://github.com/Frickeldave/squad-heroes.git /pfad/zum/squad-heroes

squad plugin validate /pfad/zum/squad-heroes
squad plugin dry-run /pfad/zum/squad-heroes
squad plugin install /pfad/zum/squad-heroes
squad plugin enable squad-heroes
squad plugin verify
```

Der Plugin-Dry-run listet ausschließlich Einträge unter
`templates/squad-heroes/companion/`. Danach den **kopierten** Companion
lokalisieren und zuerst prüfen:

```bash
node .squad/templates/squad-heroes/companion/scripts/install --target "$PWD" --dry-run
```

Dieser zweite Lauf zeigt den vollständigen Companion-Plan für aktive Ziele.

In einem Terminal fragt der Wizard nach Profil, Repository, Sprache,
Deployment-Branches, Review-Baseline, Modellen und optionalem Board-Sync.
Initial werden Repository und Branches benötigt; leere optionale Eingaben
verwenden angezeigte Standardwerte bzw. bleiben deaktiviert. Der Wizard fragt
nie nach Tokens und persistiert keine Credentials.

Für CI/Tests bleibt alles explizit und nicht-interaktiv:

```bash
node .squad/templates/squad-heroes/companion/scripts/install \
  --target "$PWD" \
  --repository owner/repository \
  --profile typescript-development \
  --language de \
  --deployment-branches 2 \
  --deployment-branch-1 main \
  --deployment-branch-2 int \
  --model-reqeng mai-code-2 \
  --model-work claude-sonnet-5.5 \
  --model-review gpt-6.1-terra \
  --dry-run
```

Nach Prüfung denselben lokal installierten Companion-Befehl ohne `--dry-run`
ausführen. Erst dieser Schritt materialisiert aktive Ziele wie
`scripts/start-work.mjs`, Workflows, Prompts und Agent-Charters. Er ist
konfliktsicher und wiederholte Ausführung ist ein No-op.

## Update und Entfernung

Squad 2.0.0 besitzt keinen `plugin update`-Befehl. Ein neuer Checkout wird
wieder über `install` eingespielt:

```bash
squad plugin verify &&
squad plugin install /pfad/zum/neueren/squad-heroes &&
squad plugin verify
```

Das aktualisiert ausschließlich das verwaltete Bundle. Aktive Companion-Ziele
bleiben unverändert. Erst ein expliziter erneuter Aufruf des lokal kopierten
Companions aktualisiert diese Ziele:

```bash
node .squad/templates/squad-heroes/companion/scripts/install --target "$PWD" --dry-run
node .squad/templates/squad-heroes/companion/scripts/install --target "$PWD"
```

Bei vorhandener `.squad/heroes.json` werden Konfigurationswerte für dieses
Companion-Rerun übernommen, außer ausdrücklich angegebene Flags. Profile,
Repository, Branches, Sprache und Modelle werden weiterhin sichtbar geplant.

`squad plugin uninstall squad-heroes` entfernt nur die Bundle-Dateien und den
Plugin-State; aktive, vom Companion erzeugte Dateien bleiben bestehen.

## Voraussetzungen und Sicherheit

- Node.js 20+, npm für die Produktentwicklung
- Squad `2.0.0` oder höher, stabil (kein Prerelease)
- lokal installierter `gh`, authentifiziert und mit Push-Recht
- genau ein stabiler `<!-- version: X.Y.Z -->`-Marker in
  `.github/agents/squad.agent.md`

Der Companion prüft Squad, GitHub-Authentifizierung und Push-Recht, fordert
niemals Token an und speichert keine Credentials. Konflikte werden vor dem
ersten Schreibzugriff angezeigt.

## Dokumentation

- Deutsch: [Installation](docs/de/installation.md), [Konfiguration](docs/de/konfiguration.md),
  [Sicherheit](docs/de/sicherheit.md), [Recovery](docs/de/recovery.md),
  [End-to-End-Testplan](docs/de/testplan-snake.md)
- English: [Installation](docs/en/installation.md), [Configuration](docs/en/configuration.md),
  [Security](docs/en/security.md), [Recovery](docs/en/recovery.md),
  [End-to-end test plan](docs/en/testplan-snake.md)

## Entwicklung

```bash
npm ci
npm run check
npm run smoke
squad plugin validate .
git diff --check
```

Bereits installierte Consumer, die noch die frühere direkte Quell-Installation
verwenden: Plugin aus diesem Stand erneut installieren, dann ausschließlich
die oben dokumentierte kopierte Companion-Installation verwenden. Der externe
Checkout wird nur noch benötigt, um das Plugin zu installieren/aktualisieren.
