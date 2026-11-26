#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { walkFiles, sha256Bytes } from '../src/manifest.mjs';

const root = path.resolve(import.meta.dirname, '..');
const sourceRoot = path.join(root, '.squad/heroes');
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
  `${JSON.stringify({ schemaVersion: 1, plugin: 'squad-heroes', version: '0.1.0', files }, null, 2)}\n`
);

const executable = /\.(?:cjs|js|mjs|sh|ts|tsx)$/u;
const staticFiles = walkFiles(sourceRoot).filter((file) =>
  /^(?:agents|prompts|profiles|skills)\//u.test(file) && file !== 'manifest.json' && !executable.test(file)
);
const marketplaceFiles = staticFiles.map((file) => {
  const [root, ...rest] = file.split('/');
  const targetRoot = root === 'prompts' ? 'prompts' : 'templates';
  return {
    source: `.squad/heroes/${file}`,
    target: `${targetRoot}/squad-heroes/${root}/${rest.join('/')}`,
    type: root === 'prompts' ? 'prompt' : root === 'agents' ? 'template' : 'template',
  };
});
const marketplace = {
  id: 'squad-heroes',
  name: 'squad-heroes',
  version: '0.1.0',
  description: 'Generic TypeScript Squad overlay with static agent and prompt sources.',
  license: 'MIT',
  squad: '>=2.0.0',
  repository: { type: 'github', url: 'https://github.com/Frickeldave/squad-heroes.git' },
  components: { templates: true },
  files: marketplaceFiles,
};
writeFileSync(path.join(root, 'plugin.manifest.json'), `${JSON.stringify(marketplace, null, 2)}\n`);
writeFileSync(path.join(root, 'plugin.json'), `${JSON.stringify(marketplace, null, 2)}\n`);
