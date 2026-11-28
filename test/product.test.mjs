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
  assert.ok(marketplace.files.length > 50);
  assert.ok(marketplace.files.every(({ target }) =>
    target.startsWith('templates/squad-heroes/companion/')));
  assert.ok(marketplace.files.some(({ target }) =>
    target === 'templates/squad-heroes/companion/scripts/install'));
  assert.ok(marketplace.files.some(({ target }) =>
    target === 'templates/squad-heroes/companion/src/installer'));
  assert.ok(marketplace.files.some(({ target }) =>
    target === 'templates/squad-heroes/companion/.squad/heroes/companion/scripts/start-work'));
  assert.ok(marketplace.files.some(({ target }) =>
    target === 'templates/squad-heroes/companion/.squad/heroes/companion/workflows/heroes-ci.yml'));
  assert.ok(marketplace.files.some(({ target }) =>
    target === 'templates/squad-heroes/companion/.squad/heroes/skills/humanizer/de-DE.md'));
  assert.ok(marketplace.files.some(({ target }) =>
    target === 'templates/squad-heroes/companion/.squad/heroes/skills/humanizer/en-US.md'));
  assert.ok(marketplace.files.some(({ target }) =>
    target === 'templates/squad-heroes/companion/resources/messages.en.json'));
  assert.ok(marketplace.files.some(({ target }) =>
    target === 'templates/squad-heroes/companion/.squad/heroes/companion-targets.json'));
  assert.ok(marketplace.files.every(({ target }) =>
    !/^\.github\/|^scripts\/|^\.squad\/agents\//u.test(target)));
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
  assert.match(readme, /squad plugin dry-run[\s\S]*companion\/scripts\/install[\s\S]*--dry-run/u);
  assert.match(readme, /zwei getrennte Pläne/u);
  assert.match(readme, /vollständige versionierte Distribution/u);
});

test('installation docs and test plans distinguish plugin and Companion dry-runs', () => {
  for (const language of ['de', 'en']) {
    const installation = readFileSync(path.join(root, 'docs', language, 'installation.md'), 'utf8');
    const testplan = readFileSync(path.join(root, 'docs', language, 'testplan-snake.md'), 'utf8');
    assert.match(installation, /squad plugin dry-run/u);
    assert.match(installation, /companion\/scripts\/install[\s\S]*--dry-run/u);
    assert.match(installation, /scripts\/start-work\.mjs/u);
    assert.match(installation, /\.github\/workflows\/heroes-ci\.yml/u);
    assert.match(testplan, /squad plugin dry-run/u);
    assert.match(testplan, /scripts\/start-work\.mjs/u);
    assert.match(testplan, /\.github\/workflows\/heroes-ci\.yml/u);
    assert.match(testplan, /templates\/squad-heroes\/companion\/src\/installer/u);
    assert.match(testplan, /\.squad\/heroes\/companion\/workflows\/heroes-ci\.yml/u);
    assert.match(testplan, /(?:Plugin-Distributionsplan|plugin distribution plan)/u);
    assert.match(testplan, /(?:Companion-Aktivierungsplan|Companion activation plan)/u);
  }
});

test('documentation and runtime copy describe two separate installation phases', () => {
  const files = [
    'README.md',
    'docs/de/installation.md',
    'docs/de/recovery.md',
    'docs/de/sicherheit.md',
    'docs/de/testplan-snake.md',
    'docs/en/installation.md',
    'docs/en/recovery.md',
    'docs/en/security.md',
    'docs/en/testplan-snake.md',
    'resources/messages.de.json',
    'resources/messages.en.json',
    'scripts/install.mjs',
    'scripts/plugin-preflight.mjs',
  ];
  const content = files.map((file) => readFileSync(path.join(root, file), 'utf8')).join('\n');
  const stale = [
    /(?:must|plan).{0,30}only.{0,20}static/u,
    /ausschlie(?:ß|ss)lich.{0,20}statische Templates/iu,
    /(?:scripts|Workflows).{0,30}(?:may.{1,3}not.{1,3}appear|dürfen.{1,3}dort.{1,3}nicht.{1,3}erscheinen)/iu,
    /not (?:the )?complete.{1,5}product plan/iu,
    /nicht der.{1,5}ständige Produktplan/iu,
  ];
  for (const pattern of stale) assert.doesNotMatch(content, pattern);
  assert.match(content, /templates\/squad-heroes\/companion\//u);
  assert.match(content, /\.squad\/heroes\/companion\/workflows\/heroes-ci\.yml/u);
});

test('Snake issue bodies are parallel and linked with ordered flow handoffs', () => {
  const pairs = [
    ['docs/de/testplan-snake.md', 'docs/de/testplan-snake-issue.md'],
    ['docs/en/testplan-snake.md', 'docs/en/testplan-snake-issue.md'],
  ];
  const expectedHeadings = 10;
  for (const [planFile, issueFile] of pairs) {
    const plan = readFileSync(path.join(root, planFile), 'utf8');
    const issue = readFileSync(path.join(root, issueFile), 'utf8');
    assert.match(plan, new RegExp(path.basename(issueFile).replaceAll('.', '\\.'), 'u'));
    assert.ok((issue.match(/^## /gmu) ?? []).length >= expectedHeadings);
    assert.match(plan, /start-reqeng\.mjs --issue/u);
    assert.match(plan, /start-work\.mjs --issue/u);
    assert.match(plan, /start-review\.mjs --pr/u);
    assert.match(plan, /Closes #\{snake-issue\}/u);
    assert.doesNotMatch(issue, /\/commit\/|\/pull\/|git (?:log|show)/iu);
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
    assert.match(result.stdout, /squad plugin dry-run.+complete versioned distribution/u);
    assert.match(result.stdout, /templates\/squad-heroes\/companion\//u);
    assert.match(result.stdout, /copied Companion/u);
    assert.match(result.stdout, /templates\/squad-heroes\/companion\/scripts\/install/u);
    assert.match(result.stdout, /--profile typescript-development/u);
    assert.match(result.stdout, /--dry-run/u);
  } finally {
    cleanup(target);
  }
});
