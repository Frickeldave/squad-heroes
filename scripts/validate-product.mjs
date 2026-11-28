#!/usr/bin/env node
import { parseJsonFile, safeRelativePath } from '../src/io.mjs';
import { validateManifest } from '../src/manifest.mjs';
import { validateMessageCatalogs } from '../src/messages.mjs';
import { PROFILE_ID, validateHeroesConfig } from '../src/config.mjs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const plugin = parseJsonFile(path.join(root, 'plugin.json'));
if (plugin.id !== 'squad-heroes' || plugin.name !== 'squad-heroes') throw new Error('invalid product identity');
validateManifest(root, parseJsonFile(path.join(root, '.squad/heroes/manifest.json')));
validateMessageCatalogs();
const profile = parseJsonFile(path.join(root, '.squad/heroes/001/profile.json'));
if (profile.id !== PROFILE_ID || profile.agents.map(({ id }) => id).join(',') !== 'tony,pepper,bruce,clint,maria,natasha,nick') {
  throw new Error('profile matrix is invalid');
}
const catalog = parseJsonFile(path.join(root, '.squad/heroes/companion-targets.json'));
for (const target of catalog.targets) {
  if (!safeRelativePath(target.source) || !safeRelativePath(target.target)) throw new Error('unsafe catalog path');
  if (target.target.startsWith('.squad/heroes/') && target.owner === 'companion') throw new Error('ownership collision');
}
console.log(`validated squad-heroes ${plugin.version}: ${catalog.targets.length} companion targets`);
