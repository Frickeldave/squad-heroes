import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { parseJsonFile, safeRelativePath } from '../src/io.mjs';
import { validateManifest } from '../src/manifest.mjs';
import { cleanup, fixture } from './helpers.mjs';

const root = path.resolve(import.meta.dirname, '..');

test('manifest is static, checksummed and plugin files never target outside .squad', () => {
  const manifest = parseJsonFile(path.join(root, '.squad/heroes/manifest.json'));
  validateManifest(root, manifest);
  assert.ok(manifest.files.length > 30);
  for (const file of manifest.files) assert.ok(file.target.startsWith('.squad/'));
  assert.ok(!manifest.files.some(({ source }) => /scripts\/install\.mjs$/u.test(source)));
  const marketplace = parseJsonFile(path.join(root, 'plugin.manifest.json'));
  assert.equal(marketplace.squad, '>=2.0.0');
  assert.ok(marketplace.files.length > 10);
  assert.ok(marketplace.files.every(({ source }) => !/\.(?:mjs|js|sh|ts)$/u.test(source)));
});

test('companion targets are explicit, unique and board sync is separately gated', () => {
  const catalog = parseJsonFile(path.join(root, '.squad/heroes/companion-targets.json'));
  assert.equal(new Set(catalog.targets.map(({ target }) => target)).size, catalog.targets.length);
  for (const entry of catalog.targets) {
    assert.ok(safeRelativePath(entry.source));
    assert.ok(safeRelativePath(entry.target));
  }
  const sync = catalog.targets.find(({ target }) => target.endsWith('heroes-sync-project-board.yml'));
  assert.equal(sync.extension, 'board-sync');
});

test('obsolete passive skill is absent from source, distribution and generated metadata', () => {
  const removedSkill = ['squad-heroes', 'flow', 'safety'].join('-');
  const profile = parseJsonFile(path.join(root, '.squad/heroes/profiles/typescript-development.json'));
  const removedSource = path.join(root, '.squad/heroes/skills', removedSkill, 'SKILL.md');
  const sources = [
    readFileSync(path.join(root, 'plugin.manifest.json'), 'utf8'),
    readFileSync(path.join(root, 'plugin.json'), 'utf8'),
    readFileSync(path.join(root, '.squad/heroes/manifest.json'), 'utf8'),
    readFileSync(path.join(root, '.squad/heroes/companion-targets.json'), 'utf8'),
  ];
  assert.ok(!profile.skills.includes(removedSkill));
  assert.equal(existsSync(removedSource), false);
  assert.ok(sources.every((source) => !source.includes(removedSkill)));
});

test('distributed source contains no CRAFT, SupplierPulse or credential literals', () => {
  const manifest = parseJsonFile(path.join(root, '.squad/heroes/manifest.json'));
  const forbidden = /adesso-dzadjhac|supplierpulse|no_sync|ghp_[A-Za-z0-9]+|github_pat_/iu;
  for (const { source } of manifest.files) {
    assert.doesNotMatch(readFileSync(path.join(root, source), 'utf8'), forbidden, source);
  }
});

test('launchers never extract or pass authentication tokens', () => {
  const helper = readFileSync(
    path.join(root, '.squad/heroes/companion/scripts/flow-shared.mjs'),
    'utf8'
  );
  assert.doesNotMatch(helper, /gh['"]?\s*,\s*\[['"]auth['"]\s*,\s*['"]token/u);
  assert.doesNotMatch(helper, /Authorization\s*:\s*`?Bearer/u);
  assert.match(helper, /COPILOT_HOME/u);
  assert.match(helper, /copilot['"]\s*,\s*\[['"]config['"]\s*,\s*['"]model/u);
});

test('consumer workflow set is separate and least-privileged', () => {
  const catalog = parseJsonFile(path.join(root, '.squad/heroes/companion-targets.json'));
  const workflows = catalog.targets.filter(({ target }) => target.endsWith('.yml'));
  assert.equal(workflows.length, 5);
  assert.ok(workflows.find(({ target }) => target.endsWith('heroes-sync-project-board.yml')).extension);
  const sources = workflows.map(({ source }) => readFileSync(path.join(root, source), 'utf8'));
  assert.ok(sources.every((source) => source.includes('ubuntu-latest')));
  assert.ok(!sources.some((source) => source.includes('[self-hosted, craft]')));
});

test('documentation has parallel chapters and required root entry point', () => {
  const pairs = [
    ['installation.md', 'installation.md'],
    ['konfiguration.md', 'configuration.md'],
    ['sicherheit.md', 'security.md'],
    ['workflows.md', 'workflows.md'],
    ['recovery.md', 'recovery.md'],
    ['nicht-ziele.md', 'non-goals.md'],
    ['testplan-snake.md', 'testplan-snake.md'],
  ];
  for (const [de, en] of pairs) {
    const german = readFileSync(path.join(root, 'docs/de', de), 'utf8');
    const english = readFileSync(path.join(root, 'docs/en', en), 'utf8');
    assert.equal((german.match(/^## /gmu) ?? []).length, (english.match(/^## /gmu) ?? []).length, `${de}/${en}`);
  }
  const readme = readFileSync(path.join(root, 'README.md'), 'utf8');
  assert.match(readme, /docs\/de\/installation\.md/);
  assert.match(readme, /docs\/en\/installation\.md/);
  assert.match(readme, /squad plugin dry-run[\s\S]*scripts\/install\.mjs[\s\S]*--dry-run/u);
  assert.match(readme, /vollständigen Companion-Plan/u);
});

test('installation docs and test plans distinguish plugin and Companion dry-runs', () => {
  for (const language of ['de', 'en']) {
    const installation = readFileSync(path.join(root, 'docs', language, 'installation.md'), 'utf8');
    const testplan = readFileSync(path.join(root, 'docs', language, 'testplan-snake.md'), 'utf8');
    assert.match(installation, /squad plugin dry-run/u);
    assert.match(installation, /scripts\/install\.mjs[\s\S]*--dry-run/u);
    assert.match(installation, /scripts\/start-work\.mjs/u);
    assert.match(installation, /\.github\/workflows\/heroes-ci\.yml/u);
    assert.match(testplan, /squad plugin dry-run/u);
    assert.match(testplan, /scripts\/start-work\.mjs/u);
    assert.match(testplan, /\.github\/workflows\/heroes-ci\.yml/u);
  }
});

test('plugin preflight points directly to the Companion dry-run', () => {
  const target = fixture();
  try {
    const result = spawnSync(process.execPath, [
      path.join(root, 'scripts/plugin-preflight.mjs'),
      '--target',
      target,
    ], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /squad plugin dry-run.+only static/u);
    assert.match(result.stdout, /Companion dry-run separately/u);
    assert.match(result.stdout, /scripts\/install\.mjs/u);
    assert.match(result.stdout, /--profile typescript-development/u);
    assert.match(result.stdout, /--dry-run/u);
  } finally {
    cleanup(target);
  }
});
