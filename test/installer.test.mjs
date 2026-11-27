import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { applyPlan, buildInstallPlan, printPlan } from '../src/installer.mjs';
import { parseJsonFile } from '../src/io.mjs';
import { cleanup, commandResult, fixture, write } from './helpers.mjs';

const productRoot = path.resolve(import.meta.dirname, '..');
const options = {
  repository: 'owner/repository',
  profile: 'typescript-development',
  language: 'en',
  branches: ['main'],
  models: { reqeng: 'mai-code-2', work: 'sonnet-code-2', review: 'opus-code-2' },
  boardSync: false,
  locale: 'en_US',
};
const injected = {
  cwd: '.',
  spawn: (command, args) => args[0] === 'auth' ? commandResult() : commandResult('true\n'),
};

test('fresh dry-run plans plugin and companion separately without mutation', () => {
  const root = fixture();
  try {
    const plan = buildInstallPlan(root, options, injected);
    const defaultScripts = parseJsonFile(path.join(productRoot, '.squad/heroes/companion-targets.json'))
      .targets
      .filter(({ target, extension }) => !extension && /^scripts\/.+\.mjs$/u.test(target));
    for (const { target } of defaultScripts) {
      assert.ok(plan.operations.some((entry) => entry.target === target), `missing planned script: ${target}`);
    }
    assert.ok(plan.operations.some((entry) => entry.target === '.github/workflows/heroes-ci.yml'));
    assert.ok(plan.operations.some((entry) => entry.target === 'scripts/start-work.mjs'));
    assert.ok(plan.operations.some((entry) => entry.target === 'scripts/check-release-label.mjs'));
    assert.ok(plan.operations.some((entry) => entry.target === '.squad/agents/clint/charter.md'));
    assert.ok(!plan.operations.some((entry) => entry.target.endsWith('heroes-sync-project-board.yml')));
    const result = applyPlan(root, plan, { dryRun: true }, injected);
    assert.equal(result.changed, 0);
    assert.ok(result.plan.some((entry) => entry.target === 'scripts/start-work.mjs'));
    assert.ok(result.plan.some((entry) => entry.target === '.github/workflows/heroes-ci.yml'));
    assert.ok(result.plan.every((entry) => entry.owner === 'companion'));
    assert.equal(existsSync(path.join(root, '.squad/heroes.json')), false);

    const writes = [];
    const originalWrite = process.stdout.write;
    process.stdout.write = (chunk) => {
      writes.push(String(chunk));
      return true;
    };
    try {
      printPlan(plan, 'en');
    } finally {
      process.stdout.write = originalWrite;
    }
    const output = writes.join('');
    assert.match(output, /separate plan/u);
    assert.match(output, /scripts\/start-work\.mjs/u);
    assert.match(output, /\.github\/workflows\/heroes-ci\.yml/u);
  } finally {
    cleanup(root);
  }
});

test('installation materializes both languages and an identical second run is a no-op', () => {
  const root = fixture();
  try {
    const first = buildInstallPlan(root, options, injected);
    const installed = applyPlan(root, first, {}, injected);
    assert.ok(installed.changed > 20);
    assert.ok(existsSync(path.join(root, '.squad/agents/tony/charter.de.md')));
    assert.ok(existsSync(path.join(root, '.squad/agents/tony/charter.en.md')));
    const installedScriptTargets = parseJsonFile(
      path.join(productRoot, '.squad/heroes/companion-targets.json')
    ).targets
      .filter(({ target, extension }) => !extension && /^scripts\/.+\.mjs$/u.test(target))
      .map(({ target }) => target);
    for (const target of installedScriptTargets) {
      assert.ok(existsSync(path.join(root, target)), `missing installed script: ${target}`);
    }
    const state = JSON.parse(readFileSync(path.join(root, '.squad/heroes.json'), 'utf8'));
    assert.equal(state.profile, 'typescript-development');
    const rerun = applyPlan(root, buildInstallPlan(root, options, injected), {}, injected);
    assert.equal(rerun.changed, 0);
  } finally {
    cleanup(root);
  }
});

test('conflicting local team blocks installation before its first write', () => {
  const root = fixture();
  try {
    write(root, '.squad/team.md', 'local roster\n');
    const plan = buildInstallPlan(root, options, injected);
    assert.ok(plan.conflicts.some((entry) => entry.target === '.squad/team.md'));
    assert.throws(() => applyPlan(root, plan, {}, injected), /unresolved conflicts/);
    assert.equal(existsSync(path.join(root, '.squad/heroes.json')), false);
  } finally {
    cleanup(root);
  }
});

test('unsupported version changed between plan and write aborts before mutation', () => {
  const root = fixture();
  try {
    const plan = buildInstallPlan(root, options, injected);
    write(root, '.github/agents/squad.agent.md', '<!-- version: 0.13.1 -->\n');
    assert.throws(() => applyPlan(root, plan, {}, injected), /Installation aborted before mutation/);
    assert.equal(existsSync(path.join(root, '.squad/heroes.json')), false);
  } finally {
    cleanup(root);
  }
});

test('profile identity is immutable on update', () => {
  const root = fixture();
  try {
    applyPlan(root, buildInstallPlan(root, options, injected), {}, injected);
    assert.throws(() => buildInstallPlan(root, { ...options, profile: 'other' }, injected), /immutable/);
  } finally {
    cleanup(root);
  }
});

test('confirmed deployment branch update changes workflow and state as one visible plan', () => {
  const root = fixture();
  try {
    applyPlan(root, buildInstallPlan(root, options, injected), {}, injected);
    const changed = { ...options, branches: ['main', 'int'] };
    const unapproved = buildInstallPlan(root, changed, injected);
    assert.ok(unapproved.conflicts.some(({ target }) => target === '.squad/heroes.json'));
    assert.throws(() => applyPlan(root, unapproved, {}, injected), /unresolved conflicts/);

    const decisionFile = path.join(root, 'decisions.json');
    write(root, 'decisions.json', JSON.stringify({
      '.squad/heroes.json': 'use',
      '.github/workflows/heroes-ci.yml': 'use',
      '.github/workflows/heroes-update-badges.yml': 'use',
    }));
    const approved = buildInstallPlan(root, { ...changed, decisionFile }, injected);
    applyPlan(root, approved, {}, injected);
    const state = JSON.parse(readFileSync(path.join(root, '.squad/heroes.json'), 'utf8'));
    assert.deepEqual(state.deploymentBranches, ['main', 'int']);
    assert.match(readFileSync(path.join(root, '.github/workflows/heroes-ci.yml'), 'utf8'), /"main","int"/);
    assert.equal(applyPlan(root, buildInstallPlan(root, { ...changed, decisionFile }, injected), {}, injected).changed, 0);
  } finally {
    cleanup(root);
  }
});

test('unchanged managed baselines update without conflict while local drift fails closed', () => {
  const root = fixture();
  try {
    applyPlan(root, buildInstallPlan(root, options, injected), {}, injected);
    const oldConfig = JSON.parse(readFileSync(path.join(root, '.squad/heroes.json'), 'utf8'));
    assert.ok(Object.keys(oldConfig.recovery.targets).length > 30);
    const same = buildInstallPlan(root, options, injected);
    assert.equal(same.conflicts.length, 0);

    const team = path.join(root, '.squad/team.md');
    write(root, '.squad/team.md', readFileSync(team, 'utf8').replace(
      '<!-- squad-heroes:team:end -->',
      'local managed drift\n<!-- squad-heroes:team:end -->'
    ));
    const drift = buildInstallPlan(root, options, injected);
    const conflict = drift.conflicts.find(({ target }) => target === '.squad/team.md');
    assert.ok(conflict);
    assert.deepEqual(conflict.options, ['use', 'keep', 'merge', 'abort']);
    assert.throws(() => applyPlan(root, drift, {}, injected), /unresolved conflicts/);
  } finally {
    cleanup(root);
  }
});
