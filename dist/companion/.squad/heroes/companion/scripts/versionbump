#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/u.test(version ?? '')) throw new Error('version must use strict X.Y.Z');
const workspaces = JSON.parse(readFileSync('package.json', 'utf8')).workspaces ?? [];
for (const file of ['package.json', ...workspaces.map((workspace) => `${workspace}/package.json`)]) {
  const json = JSON.parse(readFileSync(file, 'utf8'));
  json.version = version;
  writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
}
console.log(`Updated configured package versions to ${version}; no commit, push or deploy performed.`);
if (process.env.SKIP_LOCKFILE !== 'true') {
  const result = spawnSync('npm', ['install', '--package-lock-only', '--ignore-scripts'], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error('could not regenerate package lock');
}
