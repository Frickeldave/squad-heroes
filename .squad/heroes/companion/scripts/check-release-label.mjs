#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

let labels = String(process.env.PR_LABELS ?? '').split(',').filter(Boolean);
if (labels.length === 0 && process.env.PR_NUMBER) {
  const details = spawnSync('gh', [
    'pr', 'view', process.env.PR_NUMBER, '--repo', process.env.GITHUB_REPOSITORY,
    '--json', 'labels', '--jq', '(.labels // []) | map(.name) | join(\",\")',
  ], { encoding: 'utf8' });
  if (details.status !== 0) throw new Error('pull request labels are unavailable');
  labels = details.stdout.trim().split(',').filter(Boolean);
}
const yesLabel = process.env.RELEASE_LABEL_YES ?? 'release:yes';
const noLabel = process.env.RELEASE_LABEL_NO ?? 'release:no';
const yes = labels.includes(yesLabel);
const no = labels.includes(noLabel);
if (yes === no) throw new Error(`PR requires exactly one of ${yesLabel} and ${noLabel}`);

function semver(value) {
  return /^\d+\.\d+\.\d+$/u.test(value);
}
function compare(left, right) {
  const a = left.split('.').map(Number);
  const b = right.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}
function packages() {
  const root = JSON.parse(readFileSync('package.json', 'utf8'));
  const workspaces = Array.isArray(root.workspaces) ? root.workspaces : (root.workspaces?.packages ?? []);
  return [['package.json', root], ...workspaces.flatMap((pattern) => {
    if (pattern.includes('*')) throw new Error('workspace globs require an explicit consumer adapter');
    const file = path.join(pattern, 'package.json');
    return existsSync(file) ? [[file, JSON.parse(readFileSync(file, 'utf8'))]] : [];
  })];
}

const allPackages = packages();
const version = allPackages[0][1].version;
if (!semver(version)) throw new Error('root version must use strict X.Y.Z');
for (const [file, manifest] of allPackages.slice(1)) {
  if (manifest.version !== version) throw new Error(`${file} version differs from root`);
}

if (yes) {
  if (!process.env.GITHUB_REPOSITORY || !process.env.RELEASE_TAG_PREFIX) {
    throw new Error('positive release gate requires repository and release tag prefix');
  }
  const result = spawnSync('gh', [
    'api', `repos/${process.env.GITHUB_REPOSITORY}/releases?per_page=100`,
    '--paginate', '--slurp',
  ], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`cannot read releases: ${result.stderr.trim()}`);
  const releases = JSON.parse(result.stdout).flat();
  const versions = releases
    .map(({ tag_name }) => tag_name?.startsWith(process.env.RELEASE_TAG_PREFIX) ? tag_name.slice(process.env.RELEASE_TAG_PREFIX.length) : null)
    .filter(semver);
  if (versions.length > 0 && versions.every((candidate) => compare(version, candidate) <= 0)) {
    throw new Error(`version ${version} must exceed every configured release version`);
  }
} else {
  let baseSha = process.env.GITHUB_BASE_SHA;
  if (!baseSha && process.env.PR_NUMBER) {
    const base = spawnSync('gh', [
      'pr', 'view', process.env.PR_NUMBER, '--repo', process.env.GITHUB_REPOSITORY,
      '--json', 'baseRefOid', '--jq', '.baseRefOid',
    ], { encoding: 'utf8' });
    if (base.status === 0) baseSha = base.stdout.trim();
  }
  if (!baseSha) throw new Error('negative release gate requires the verified PR base SHA');
  const mergeBase = spawnSync('git', ['merge-base', 'HEAD', baseSha], { encoding: 'utf8' });
  if (mergeBase.status !== 0) throw new Error('cannot resolve merge base');
  const base = spawnSync('git', ['show', `${mergeBase.stdout.trim()}:package.json`], { encoding: 'utf8' });
  if (base.status !== 0 || JSON.parse(base.stdout).version !== version) {
    throw new Error('release:no requires exact version equality with the merge base');
  }
}
console.log(`release gate read-only: ${version}, ${yes ? yesLabel : noLabel}`);
