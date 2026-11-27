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
  const targetRoot = path.resolve(args[targetFlag + 1]);
  assertSquadCompatibility(targetRoot);
  validateManifest(productRoot, parseJsonFile(path.join(productRoot, '.squad/heroes/manifest.json')));
  console.log('Plugin preflight passed for static marketplace content.');
  console.log('`squad plugin dry-run <squad-heroes-dir>` shows only static Squad plugin targets.');
  console.log('To see active scripts, prompts, workflows, and agents, run the Companion dry-run separately:');
  console.log(
    `node ${JSON.stringify(path.join(productRoot, 'scripts/install.mjs'))} --target ${JSON.stringify(targetRoot)} ` +
    '--repository owner/name --profile typescript-development --deployment-branches 1 ' +
    '--deployment-branch-1 main --language en --dry-run'
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = error instanceof HeroesError && error.code === 'squad_version'
    ? INCOMPATIBLE_SQUAD_EXIT
    : 1;
}
