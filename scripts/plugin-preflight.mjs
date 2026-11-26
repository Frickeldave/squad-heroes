#!/usr/bin/env node
import path from 'node:path';
import { assertSquadCompatibility } from '../src/preflight.mjs';
import { parseJsonFile } from '../src/io.mjs';
import { validateManifest } from '../src/manifest.mjs';
import { HeroesError, INCOMPATIBLE_SQUAD_EXIT } from '../src/errors.mjs';

try {
  const args = process.argv.slice(2);
  const targetFlag = args.indexOf('--target');
  if (targetFlag < 0 || !args[targetFlag + 1]) throw new Error('Usage: plugin-preflight.mjs --target /repo');
  const productRoot = path.resolve(import.meta.dirname, '..');
  assertSquadCompatibility(path.resolve(args[targetFlag + 1]));
  validateManifest(productRoot, parseJsonFile(path.join(productRoot, '.squad/heroes/manifest.json')));
  console.log('Plugin preflight passed. Run the verified `squad plugin install` lifecycle command for the static marketplace content.');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = error instanceof HeroesError && error.code === 'squad_version'
    ? INCOMPATIBLE_SQUAD_EXIT
    : 1;
}
