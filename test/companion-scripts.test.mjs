import test from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, chmodSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { applyPlan, buildInstallPlan } from '../src/installer.mjs';
import { cleanup, commandResult, fixture, write } from './helpers.mjs';

const product = path.resolve(import.meta.dirname, '..');
const injected = {
  cwd: '.',
  spawn: (command, args) => {
    if (args[0] === 'auth') return commandResult("- Token scopes: 'repo', 'project'\n");
    if (args[0] === 'api' && args[1] === 'user') return commandResult('octocat\n');
    if (args[0] === 'api' && args[1].startsWith('repos/')) {
      return commandResult('{"pull":true,"push":true,"admin":false,"triage":false}\n');
    }
    if (args[0] === 'project' && args[1] === 'list') return commandResult('{"projects":[]}\n');
    return commandResult();
  },
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

test('materialized launcher preserves --model runtime override', () => {
  const root = installed();
  try {
    const bin = path.join(root, 'bin');
    write(root, 'bin/gh', '#!/bin/sh\nif [ "$1" = "api" ]; then printf "true\\n"; fi\nexit 0\n');
    write(root, 'bin/copilot', `#!/bin/sh
if [ "$1" = "config" ] && [ "$2" = "model" ] && [ "$3" = "gpt-6.1-terra" ]; then exit 0; fi
exit 11
`);
    chmodSync(path.join(bin, 'gh'), 0o755);
    chmodSync(path.join(bin, 'copilot'), 0o755);
    const result = spawnSync(process.execPath, [
      '--input-type=module',
      '--eval',
      "import { resolveModel } from './scripts/heroes-flow-shared.mjs'; console.log(await resolveModel('work', ['--model', 'gpt-6.1-terra']));",
    ], {
      cwd: root,
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), 'gpt-6.1-terra');
  } finally {
    cleanup(root);
  }
});

for (const version of ['2.0.0', '2.0.1', '3.0.0']) {
  test(`materialized companion accepts Squad ${version}`, () => {
    const root = fixture(version);
    try {
      const helper = path.resolve(product, '.squad/heroes/companion/scripts/flow-shared.mjs');
      const result = spawnSync(process.execPath, [
        '--input-type=module',
        '--eval',
        `import { requireSquad2 } from ${JSON.stringify(new URL(`file://${helper}`).href)}; requireSquad2();`,
      ], { cwd: root, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
    } finally {
      cleanup(root);
    }
  });
}

test('materialized companion rejects 0.13.1 with exit 2 and update guidance', () => {
  const root = fixture('0.13.1');
  try {
    const helper = path.resolve(product, '.squad/heroes/companion/scripts/flow-shared.mjs');
    const result = spawnSync(process.execPath, [
      '--input-type=module',
      '--eval',
      `import { requireSquad2 } from ${JSON.stringify(new URL(`file://${helper}`).href)}; requireSquad2();`,
    ], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /minimum Squad version 2\.0\.0 is required; detected "0\.13\.1"/u);
    assert.match(result.stderr, /squad upgrade --self/u);
    assert.doesNotMatch(result.stderr, /ghp_|github_pat_|Authorization\s*:\s*Bearer/iu);
  } finally {
    cleanup(root);
  }
});

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
          *"auth status"*) printf '%s\n' "- Token scopes: 'repo', 'project'" ;;
          *"api graphql"*) printf '%s\n' '{"data":{"organization":{"projectV2":{"id":"P1","viewerCanUpdate":true}}}}' ;;
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
