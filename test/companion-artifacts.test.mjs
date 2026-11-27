import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { applyPlan, buildInstallPlan } from '../src/installer.mjs';
import { cleanup, commandResult, fixture } from './helpers.mjs';

const injected = {
  cwd: '.',
  spawn: (command, args) => {
    if (args[0] === 'auth') return commandResult("- Token scopes: 'repo', 'project'\n");
    if (args[0] === 'api' && args[1] === 'user') return commandResult('octocat\n');
    if (args[0] === 'api' && args[1] === 'graphql') {
      if (args.join(' ').includes('repository(owner:')) {
        return commandResult(JSON.stringify({ data: { repository: { id: 'R1' } } }));
      }
      if (args.join(' ').includes('repositories(first:100)')) {
        return commandResult(JSON.stringify({ data: { node: { repositories: { nodes: [{ id: 'R1' }] } } } }));
      }
      return commandResult(JSON.stringify({
        data: { organization: { projectV2: {
          id: 'P1', number: Number(args.find((arg) => arg.startsWith('number='))?.slice(7) ?? 7),
          viewerCanUpdate: true,
        } } },
      }));
    }
    if (args[0] === 'api' && args[1].startsWith('repos/')) {
      return commandResult('{"pull":true,"push":true,"admin":false,"triage":false}\n');
    }
    if (args[0] === 'project' && args[1] === 'view') {
      return commandResult(JSON.stringify({
        number: Number(args[2]),
        owner: { type: 'Organization' },
      }));
    }
    if (args[0] === 'project' && args[1] === 'list') {
      return commandResult(JSON.stringify({ projects: [] }));
    }
    if (args[0] === 'project' && args[1] === 'field-list') {
      return commandResult(JSON.stringify({
        fields: [{ id: 'F1', name: 'Status', options: [{ id: 'O1', name: 'Ready' }, { id: 'O2', name: 'Done' }] }],
      }));
    }
    return commandResult();
  },
};

function options(extra = {}) {
  return {
    repository: 'owner/repository',
    profile: 'typescript-development',
    language: 'en',
    branches: ['main', 'int'],
    models: { reqeng: 'mai-code-2', work: 'claude-sonnet-5.5', review: 'gpt-6.1-terra' },
    boardSync: false,
    locale: 'en_US',
    ...extra,
  };
}

test('installed launchers provide help without auth, config or Copilot mutation', () => {
  const root = fixture();
  try {
    applyPlan(root, buildInstallPlan(root, options(), injected), {}, injected);
    for (const script of ['start-reqeng.mjs', 'start-work.mjs', 'start-review.mjs']) {
      const result = spawnSync(process.execPath, [`scripts/${script}`, '--help'], {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, PATH: '/definitely-missing' },
      });
      assert.equal(result.status, 0, `${script}: ${result.stderr}`);
      assert.match(result.stdout, /Usage:/u);
    }
  } finally {
    cleanup(root);
  }
});

test('Companion installation does not create the removed passive skill', () => {
  const root = fixture();
  try {
    const removedSkill = ['squad-heroes', 'flow', 'safety'].join('-');
    applyPlan(root, buildInstallPlan(root, options(), injected), {}, injected);
    assert.equal(existsSync(path.join(root, '.github/skills', removedSkill, 'SKILL.md')), false);
  } finally {
    cleanup(root);
  }
});

test('all five rendered workflow contracts keep separation and least privilege', () => {
  const root = fixture();
  try {
    applyPlan(root, buildInstallPlan(root, options(), injected), {}, injected);
    const ci = readFileSync(path.join(root, '.github/workflows/heroes-ci.yml'), 'utf8');
    const configure = readFileSync(path.join(root, '.github/workflows/heroes-configure.yml'), 'utf8');
    const release = readFileSync(path.join(root, '.github/workflows/heroes-release-label.yml'), 'utf8');
    const badges = readFileSync(path.join(root, '.github/workflows/heroes-update-badges.yml'), 'utf8');
    assert.match(ci, /branches: \["main","int"\]/u);
    assert.match(ci, /contents: read/u);
    assert.match(configure, /issues: write/u);
    assert.doesNotMatch(configure, /project-sync|pull-requests: write/u);
    assert.match(release, /types: \[opened, synchronize, reopened, labeled, unlabeled\]/u);
    assert.match(release, /pull-requests: read/u);
    assert.match(badges, /contents: write/u);
    assert.match(badges, /\[skip ci\]/u);
    assert.match(badges, /START_SHA/u);
  } finally {
    cleanup(root);
  }
});

test('board workflow and script are absent without opt-in and complete when enabled', () => {
  const root = fixture();
  try {
    applyPlan(root, buildInstallPlan(root, options(), injected), {}, injected);
    assert.throws(
      () => readFileSync(path.join(root, '.github/workflows/heroes-sync-project-board.yml')),
      /ENOENT/u
    );
    const enabled = options({
      boardSync: true,
      board: {
        owner: 'owner',
        number: '7',
        statusField: 'Status',
        statusMap: { 'go:yes': 'Ready', 'go:done': 'Done' },
      },
    });

    test('prompt resolver rejects traversal, duplicates, symlinks and credential-shaped content', () => {
      const root = fixture();
      try {
        applyPlan(root, buildInstallPlan(root, options(), injected), {}, injected);
        const invoke = () => spawnSync(process.execPath, ['-e', [
          "import { resolvePrompt } from './scripts/resolve-heroes-prompt.mjs';",
          "console.log(resolvePrompt('reqeng', 'en'));",
        ].join(' ')], { cwd: root, encoding: 'utf8' });
        assert.equal(invoke().status, 0);

        const config = path.join(root, '.github/prompts/addon.config.json');
        const parsed = JSON.parse(readFileSync(config, 'utf8'));
        parsed.flows.reqeng.push(parsed.flows.reqeng[0]);
        process.getBuiltinModule('node:fs').writeFileSync(config, `${JSON.stringify(parsed)}\n`);
        assert.notEqual(invoke().status, 0);

        parsed.flows.reqeng = ['.github/prompts/../outside.md'];
        process.getBuiltinModule('node:fs').writeFileSync(config, `${JSON.stringify(parsed)}\n`);
        assert.notEqual(invoke().status, 0);

        process.getBuiltinModule('node:fs').writeFileSync(
          path.join(root, '.github/prompts/addon.config.json'),
          readFileSync(path.resolve('.squad/heroes/companion/addon.config.json'), 'utf8')
        );
        process.getBuiltinModule('node:fs').appendFileSync(
          path.join(root, '.github/prompts/addon-layers/common.md'),
          '\nghp_abcdefghijklmnopqrstuvwxyz1234567890\n'
        );
        assert.notEqual(invoke().status, 0);
      } finally {
        cleanup(root);
      }
    });
    const planned = buildInstallPlan(root, enabled, injected);
    assert.ok(planned.conflicts.some(({ target }) => target === '.squad/heroes.json'));
    const decisionFile = path.join(root, 'board-decisions.json');
    const fs = awaitImport();
    fs.writeFileSync(decisionFile, JSON.stringify({
      '.squad/heroes.json': 'use',
    }));
    applyPlan(root, buildInstallPlan(root, { ...enabled, decisionFile }, injected), {}, injected);
    const workflow = readFileSync(
      path.join(root, '.github/workflows/heroes-sync-project-board.yml'),
      'utf8'
    );
    assert.match(workflow, /vars\.HEROES_BOARD_SYNC == 'enabled'/u);
    assert.match(workflow, /GH_PROJECT_TOKEN: \$\{\{ secrets\.HEROES_PROJECT_TOKEN \}\}/u);
    assert.match(workflow, /GH_REPOSITORY_TOKEN: \$\{\{ github\.token \}\}/u);
    assert.doesNotMatch(workflow, /projectSecret|\{\{\s*\{\{/u);
    assert.match(workflow, /HEROES_PROJECT_STATUS_FIELD: "Status"/u);
    assert.doesNotMatch(workflow, /HEROES_BOARD_SYNC == 'enabled'.*Project-Write/u);
    assert.ok(existsSync(path.join(root, 'scripts/sync-project-board.mjs')));
  } finally {
    cleanup(root);
  }
});

function awaitImport() {
  return process.getBuiltinModule('node:fs');
}
