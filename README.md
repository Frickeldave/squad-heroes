# squad-heroes

Ein marketplace-fähiges Squad-Overlay und ein separat versionierter Companion
für TypeScript-Projekte mit GitHub Copilot.

<!-- BEGIN GENERATED BADGES -->
[![Version](https://img.shields.io/badge/version-0.1.0-blue)](package.json)
<!-- END GENERATED BADGES -->

## Überblick

`squad-heroes` besteht bewusst aus zwei getrennten Zonen:

1. **Marketplace-Plugin:** ausschließlich statische, gehashte Quellen unter
   `.squad/heroes/`; keine aktiven Agent-, GitHub-, Workflow- oder Paketdateien.
2. **Companion:** das menschlich gestartete Node-Skript `scripts/install.mjs`,
   das genehmigte Ziele materialisiert, Konflikte sichtbar plant und idempotent
   aktualisiert.

Vier Lieferbestandteile — Agent-/Prompt-Quellen, Companion-Adapter,
Launcher/Automatisierung und Dokumentation/Qualität — bilden dabei **ein**
versioniertes Overlay-Produkt. Sie sind keine vier unabhängigen Installate.

Der Installer unterstützt ein bereits installiertes Squad `2.0.0` oder höher.
Die Version kommt genau aus einem einzelnen gültigen SemVer-Marker
`<!-- version: X.Y.Z -->` in `.github/agents/squad.agent.md`. Prerelease-Marker
werden fail-closed abgewiesen.

## Voraussetzungen

- Linux
- Node.js 20+ und npm
- Squad `2.0.0` oder höher (keine Prereleases)
- `gh` mit authentifizierter Host-Konfiguration und Push-Recht
- lokal ausgechecktes Zielrepository

## Schnellstart

```bash
git clone https://github.com/Frickeldave/squad-heroes.git
cd squad-heroes
cd /pfad/zum/projekt
squad-plugin-preflight=/pfad/zum/squad-heroes/scripts/plugin-preflight.mjs
node "$squad-plugin-preflight" --target "$PWD"
squad plugin validate /pfad/zum/squad-heroes
squad plugin dry-run /pfad/zum/squad-heroes
node "$squad-plugin-preflight" --target "$PWD"
squad plugin install /pfad/zum/squad-heroes
squad plugin enable squad-heroes
squad plugin list --json
squad plugin verify
```

`squad plugin install <local-dir>` ist der **primäre Squad-native
Plugin-Lifecycle**. Aktualisierungen erfolgen
nicht über `plugin update` (dieses Kommando existiert in der unterstützten
CLI nicht), sondern durch erneutes Ausführen von:

```bash
squad plugin verify && squad plugin install /pfad/zum/aktuelleren/squad-heroes
squad plugin list --json
squad plugin verify
```

`squad plugin verify` vor der Aktualisierung ist verpflichtend: Squad überschreibt
bei `install` seine verwalteten Ziele. Bei einer lokalen Änderung meldet
`verify` einen Checksum-Fehler und `&&` verhindert den Update-Aufruf; erst nach
bewusster Lösung des Konflikts darf `install` erneut laufen. Derselbe Stand ist
idempotent. Alle Plugin-Ziele und der Plugin-State liegen unter `.squad/`;
`.squad/plugins/*` ist ausschließlich autoritativ.

Danach materialisiert der separate, menschlich gestartete Companion seine
eigenen aktiven Ziele. Er ist kein Plugin-Installer, verwaltet keine
`.squad/plugins/*`-Daten und ist kein Ersatz für `squad plugin install`:

```bash
cd /pfad/zum/squad-heroes
node scripts/install.mjs --target /pfad/zum/projekt \
  --repository owner/repository \
  --deployment-branches 2 \
  --deployment-branch-1 int \
  --deployment-branch-2 prd \
  --language de \
  --dry-run
```

Nach Prüfung des vollständigen Plans wird derselbe Befehl ohne `--dry-run`
ausgeführt. Der Installer fragt nie nach Tokens und persistiert keine Credentials.

## Dokumentation

- Deutsch: [Installation](docs/de/installation.md), [Konfiguration](docs/de/konfiguration.md),
  [Sicherheit](docs/de/sicherheit.md), [Recovery](docs/de/recovery.md),
  [End-to-End-Testplan](docs/de/testplan-snake.md)
- English: [Installation](docs/en/installation.md), [Configuration](docs/en/configuration.md),
  [Security](docs/en/security.md), [Recovery](docs/en/recovery.md),
  [End-to-end test plan](docs/en/testplan-snake.md)

## Grenzen

Das Produkt installiert Squad nicht, besitzt keinen globalen Installer und
verspricht kein globales Rollback. Board-Sync ist optional und bleibt ohne
vollständigen Opt-in aus. Details: [Nicht-Ziele](docs/de/nicht-ziele.md).

## Entwicklung

```bash
npm ci
npm run check
npm run smoke
```