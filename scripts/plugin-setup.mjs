#!/usr/bin/env node
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { assertGithubWriteAccess, assertSquadCompatibility } from '../src/preflight.mjs';
import { parseJsonFile } from '../src/io.mjs';
import { validateManifest } from '../src/manifest.mjs';
import { HeroesError, INCOMPATIBLE_SQUAD_EXIT } from '../src/errors.mjs';

try {
  const args = process.argv.slice(2);
  const targetIndex = args.indexOf('--target');
  const target = targetIndex >= 0 ? args[targetIndex + 1] : null;
  const repositoryIndex = args.indexOf('--repository');
  const repository = repositoryIndex >= 0 ? args[repositoryIndex + 1] : null;
  if (!target || !repository) throw new Error('Usage: plugin-setup.mjs --target /repo --repository owner/name');
  const productRoot = path.resolve(import.meta.dirname, '..');
  assertSquadCompatibility(path.resolve(target));
  assertGithubWriteAccess(repository);
  validateManifest(productRoot, parseJsonFile(path.join(productRoot, '.squad/heroes/manifest.json')));
  assertSquadCompatibility(path.resolve(target));
  const installed = spawnSync('squad', ['plugin', 'install', productRoot], {
    cwd: path.resolve(target),
    stdio: 'inherit',
  });
  if (installed.status !== 0) throw new Error(`Squad plugin install failed: ${installed.status ?? 'signal'}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = error instanceof HeroesError && error.code === 'squad_version'
    ? INCOMPATIBLE_SQUAD_EXIT
    : 1;
}
