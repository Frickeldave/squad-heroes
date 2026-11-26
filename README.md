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

Der Installer unterstützt ausschließlich ein bereits installiertes Squad
`2.0.0`. Die Version kommt genau aus einem einzelnen Marker
`<!-- version: X.Y.Z -->` in `.github/agents/squad.agent.md`.

## Voraussetzungen

- Linux
- Node.js 20+ und npm
- Squad exakt `2.0.0`
- `gh` mit authentifizierter Host-Konfiguration und Push-Recht
- lokal ausgechecktes Zielrepository

## Schnellstart

```bash
git clone https://github.com/Frickeldave/squad-heroes.git
cd squad-heroes
node scripts/plugin-setup.mjs --target /pfad/zum/projekt --repository owner/repository
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
  [Akzeptanzmatrix](docs/de/akzeptanzmatrix.md)
- English: [Installation](docs/en/installation.md), [Configuration](docs/en/configuration.md),
  [Security](docs/en/security.md), [Recovery](docs/en/recovery.md),
  [Acceptance matrix](docs/en/acceptance-matrix.md)

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