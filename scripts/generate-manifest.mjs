#!/usr/bin/env node
import {
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { walkFiles, sha256Bytes } from '../src/manifest.mjs';

const root = path.resolve(import.meta.dirname, '..');
const sourceRoot = path.join(root, '.squad/heroes');
const distributionRoot = path.join(root, 'dist/companion');
const productPackage = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const productVersion = productPackage.version;

const files = walkFiles(sourceRoot)
  .filter((file) => file !== 'manifest.json')
  .map((file) => {
    const source = `.squad/heroes/${file}`;
    return {
      id: source.replaceAll('/', ':'),
      source,
      target: source,
      owner: file.startsWith('companion/') || file === 'companion-targets.json' ? 'companion' : 'plugin',
      sha256: sha256Bytes(readFileSync(path.join(root, source))),
    };
  });
writeFileSync(
  path.join(sourceRoot, 'manifest.json'),
  `${JSON.stringify({ schemaVersion: 1, plugin: 'squad-heroes', version: productVersion, files }, null, 2)}\n`
);

function copyFile(source, target, transform = (content) => content) {
  mkdirSync(path.dirname(target), { recursive: true });
  const content = readFileSync(source);
  const transformed = transform(content.toString('utf8'));
  writeFileSync(target, transformed);
}

function extensionlessModules(content) {
  return content.replaceAll(/((?:from|import)\s*['"](?:\.\.?\/)[^'"]+)\.mjs(?=['"])/gu, '$1');
}

function copyHeroes() {
  const catalogPath = path.join(sourceRoot, 'companion-targets.json');
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
  for (const entry of catalog.targets) {
    if (entry.source.endsWith('.mjs')) entry.source = entry.source.slice(0, -4);
  }

  for (const relative of walkFiles(sourceRoot)) {
    if (relative === 'manifest.json' || relative === 'companion-targets.json') continue;
    const installedRelative = relative.endsWith('.mjs') ? relative.slice(0, -4) : relative;
    const target = path.join(distributionRoot, '.squad/heroes', installedRelative);
    const transform = relative.endsWith('.mjs') ? extensionlessModules : (content) => content;
    copyFile(path.join(sourceRoot, relative), target, transform);
  }
  const installedCatalog = path.join(distributionRoot, '.squad/heroes/companion-targets.json');
  mkdirSync(path.dirname(installedCatalog), { recursive: true });
  writeFileSync(installedCatalog, `${JSON.stringify(catalog, null, 2)}\n`);

  const installedManifestFiles = walkFiles(path.join(distributionRoot, '.squad/heroes'))
    .map((file) => ({
      id: `.squad/heroes/${file}`.replaceAll('/', ':'),
      source: `.squad/heroes/${file}`,
      target: `.squad/heroes/${file}`,
      owner: file.startsWith('companion/') || file === 'companion-targets.json' ? 'companion' : 'plugin',
      sha256: sha256Bytes(readFileSync(path.join(distributionRoot, '.squad/heroes', file))),
    }));
  writeFileSync(
    path.join(distributionRoot, '.squad/heroes/manifest.json'),
    `${JSON.stringify({
      schemaVersion: 1,
      plugin: 'squad-heroes',
      version: productVersion,
      files: installedManifestFiles,
    }, null, 2)}\n`
  );
}

rmSync(distributionRoot, { recursive: true, force: true });
copyHeroes();
for (const file of walkFiles(path.join(root, 'src'))) {
  copyFile(path.join(root, 'src', file), path.join(distributionRoot, 'src', file.slice(0, -4)), extensionlessModules);
}
for (const file of walkFiles(path.join(root, 'resources'))) {
  copyFile(path.join(root, 'resources', file), path.join(distributionRoot, 'resources', file));
}
copyFile(
  path.join(root, 'scripts/install.mjs'),
  path.join(distributionRoot, 'scripts/install'),
  extensionlessModules
);
writeFileSync(
  path.join(distributionRoot, 'package.json'),
  `${JSON.stringify({
    name: '@squad-heroes/companion',
    version: productVersion,
    private: true,
    type: 'module',
    engines: { node: '>=20' },
  }, null, 2)}\n`
);

const marketplaceFiles = walkFiles(distributionRoot).map((file) => ({
  source: `dist/companion/${file}`,
  target: `templates/squad-heroes/companion/${file}`,
  type: 'template',
}));
const marketplace = {
  id: 'squad-heroes',
  name: 'squad-heroes',
  version: productVersion,
  description: 'Generic TypeScript Squad overlay with a self-contained Companion distribution.',
  license: 'MIT',
  squad: '>=2.0.0',
  repository: { type: 'github', url: 'https://github.com/Frickeldave/squad-heroes.git' },
  components: { templates: true },
  files: marketplaceFiles,
};
writeFileSync(path.join(root, 'plugin.manifest.json'), `${JSON.stringify(marketplace, null, 2)}\n`);
writeFileSync(path.join(root, 'plugin.json'), `${JSON.stringify(marketplace, null, 2)}\n`);
