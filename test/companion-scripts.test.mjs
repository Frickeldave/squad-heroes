import test from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, chmodSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { applyPlan, buildInstallPlan } from '../src/installer.mjs';
import { cleanup, commandResult, fixture, write } from './helpers.mjs';

const injected = {
  cwd: '.',
  spawn: (command, args) => args[0] === 'auth' ? commandResult() : commandResult('true\n'),
};
const options = {
  repository: 'owner/repository',
  profile: 'typescript-development',
  language: 'en',
  branches: ['main'],
  models: { reqeng: 'mai-code-2', work: 'claude-sonnet-5.5', review: 'gpt-6.1-terra' },
  boardSync: false,
};

function installed() {
  const root = fixture();
  applyPlan(root, buildInstallPlan(root, options, injected), {}, injected);
  return root;
}

test('badge generator changes only the single managed marker and check is read-only', () => {
  const root = installed();
  try {
    const file = path.join(root, 'README.md');
    const first = readFileSync(file, 'utf8');
    appendFileSync(file, '\nlocal footer\n');
    const changed = spawnSync(process.execPath, ['scripts/update-badges.mjs'], { cwd: root });
    assert.equal(changed.status, 0);
    const after = readFileSync(file, 'utf8');
    assert.match(after, /local footer/u);
    assert.match(after, /BEGIN GENERATED BADGES/u);

    const checked = spawnSync(process.execPath, ['scripts/update-badges.mjs', '--check'], { cwd: root });
    assert.equal(checked.status, 0);
    const beforeCheck = readFileSync(file, 'utf8');
    const repeated = spawnSync(process.execPath, ['scripts/update-badges.mjs'], { cwd: root });
    assert.equal(repeated.status, 0);
    assert.equal(readFileSync(file, 'utf8'), beforeCheck);
    assert.ok(first.length > 0);
  } finally {
    cleanup(root);
  }
});

test('release gate enforces exactly one label and validates a greater positive version', () => {
  const root = installed();
  try {
    const bin = path.join(root, 'bin');
    const gh = path.join(bin, 'gh');
    const packageFile = path.join(root, 'package.json');
    const packageJson = JSON.parse(readFileSync(packageFile, 'utf8'));
    packageJson.version = '1.1.0';
    process.getBuiltinModule('node:fs').writeFileSync(
      packageFile,
      `${JSON.stringify(packageJson, null, 2)}\n`
    );
    write(root, 'bin/gh', '#!/bin/sh\nprintf \'[[{\"tag_name\":\"v1.0.0\"}]]\\n\'\n');
    chmodSync(gh, 0o755);
    const env = {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      PR_LABELS: 'release:yes',
      GITHUB_REPOSITORY: 'owner/repository',
      RELEASE_TAG_PREFIX: 'v',
    };
    const script = ['scripts/check-release-label.mjs'];
    const passed = spawnSync(process.execPath, script, { cwd: root, env, encoding: 'utf8' });
    assert.equal(passed.status, 0, passed.stderr);
    const failed = spawnSync(process.execPath, script, {
      cwd: root,
      env: { ...env, PR_LABELS: 'release:yes,release:no' },
      encoding: 'utf8',
    });

    test('configure script validates opt-in Project schema and creates only missing fields', () => {
      const root = installed();
      try {
        const gh = path.join(root, 'bin/gh');
        const log = path.join(root, 'gh.log');
        write(root, 'bin/gh', `#!/bin/sh
    case "$*" in
      *"label list"*) printf '[]\\n' ;;
      *"project field-list"*) printf '{"fields":[]}\\n' ;;
      *"project view"*) printf '{"id":"P1"}\\n' ;;
      *) printf '%s\\n' "$*" >> "$GH_LOG" ;;
    esac
    `);
        chmodSync(gh, 0o755);
        const env = {
          ...process.env,
          PATH: `${path.dirname(gh)}:${process.env.PATH}`,
          GH_LOG: log,
          HEROES_CONFIGURE_PROJECT: 'true',
          HEROES_PROJECT_OWNER: 'owner',
          HEROES_PROJECT_NUMBER: '7',
          HEROES_PROJECT_STATUS_FIELD: 'Status',
          HEROES_PROJECT_STATUS_MAP: JSON.stringify({ 'go:yes': 'Ready', 'go:done': 'Done' }),
        };
        const result = spawnSync(process.execPath, ['scripts/heroes-configure.mjs'], {
          cwd: root,
          env,
          encoding: 'utf8',
        });
        assert.equal(result.status, 0, result.stderr);
        const writes = readFileSync(log, 'utf8');
        assert.match(writes, /project field-create 7/u);
        assert.match(writes, /--single-select-options Ready,Done/u);
      } finally {
        cleanup(root);
      }
    });
    assert.notEqual(failed.status, 0);
    assert.match(failed.stderr, /exactly one/u);
  } finally {
    cleanup(root);
  }
});
