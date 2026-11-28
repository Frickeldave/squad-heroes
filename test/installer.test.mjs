import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import {
  applyPlan,
  buildInstallPlan,
  machinePlan,
  parseInstallArguments,
  printPlan,
} from '../src/installer.mjs';
import {
  assertGithubWriteAccess,
  resolveBoardProject,
  VERIFIED_MODEL_FALLBACK,
} from '../src/preflight.mjs';
import { parseJsonFile } from '../src/io.mjs';
import {
  completeInteractiveOptions,
  resolveConflictDecisions,
  selectWithArrowKeys,
} from '../scripts/install.mjs';
import { cleanup, commandResult, fixture, write } from './helpers.mjs';
import { EventEmitter } from 'node:events';

const productRoot = path.resolve(import.meta.dirname, '..');
const options = {
  repository: 'owner/repository',
  profile: '001',
  language: 'en',
  branches: ['main'],
  models: { reqeng: 'mai-code-2', work: 'sonnet-code-2', review: 'opus-code-2' },
  boardSync: false,
  locale: 'en_US',
};
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

test('project type parser preserves only explicit non-TTY input', () => {
  assert.equal(parseInstallArguments(['--project-type', '001']).profile, '001');
  assert.equal(parseInstallArguments([]).profile, null);
  assert.equal(parseInstallArguments(['--project-type', 'unknown']).profile, 'unknown');
  assert.equal(parseInstallArguments(['--json-plan']).jsonPlan, true);
  assert.equal(parseInstallArguments(['--plan-json', 'plan.json']).planJsonPath, 'plan.json');
});

test('interactive Companion wizard collects required and opt-in configuration', async () => {
  const answers = new Map([
    ['GitHub repository (owner/name)', 'owner/repository'],
    ['Language (de|en)', 'en'],
    ['Deployment branch count (1-3)', '2'],
    ['Deployment branch 1', 'main'],
    ['Deployment branch 2', 'int'],
    ['Review baseline commit (optional; blank keeps the configured value)', ''],
    ['Enable optional Project board sync (y/N)', 'y'],
    ['Project status field', 'Status'],
    ['Project status map JSON', JSON.stringify({ 'go:yes': 'Ready', 'go:done': 'Done' })],
  ]);
  const asked = [];
  const selected = [];
  const ghCalls = [];
  const events = [];
  const completed = await completeInteractiveOptions({
    profile: null,
    repository: null,
    language: null,
    branches: null,
    models: { reqeng: 'mai-code-2', work: 'claude-sonnet-5.5', review: 'gpt-6.1-terra' },
    explicitModels: {},
    boardSync: false,
    board: {},
  }, null, async (label, fallback) => {
    events.push(`ask:${label}`);
    asked.push(label);
    return answers.get(label) || fallback;
  }, async (label, choices, current) => {
    events.push(`choose:${label}`);
    selected.push({ label, choices, current });
    assert.ok(choices.includes(current));
    return current;
  }, {
    spawn(command, args) {
        if (args[0] === 'auth') return commandResult("- Token scopes: 'repo', 'project'\n");
      ghCalls.push([command, ...args]);
      events.push(`run:${command} ${args.join(' ')}`);
      if (command === 'copilot') {
        return commandResult('  `model`: AI model\n    - "mai-code-2"\n    - "claude-sonnet-5.5"\n    - "gpt-6.1-terra"\n\n  `next`: x\n');
      }
      if (args[0] === 'project' && args[1] === 'list') {
        return commandResult(JSON.stringify({
          projects: [{ number: 7, title: 'Snake' }, { number: 8, title: 'Roadmap' }],
        }));
      }
      if (args[0] === 'project' && args[1] === 'view') {
        return commandResult(JSON.stringify({ number: 7, title: 'Snake' }));
      }
      if (args[0] === 'api' && args[1] === 'user') return commandResult('octocat\n');
      if (args[0] === 'api' && args[1].startsWith('repos/')) {
        return commandResult('{"pull":true,"push":true}\n');
      }
      if (args[0] === 'api' && args[1] === 'graphql') {
        return commandResult('{"data":{"user":{"projectV2":{"id":"P7","number":7,"viewerCanUpdate":true}}}}\n');
      }
      return commandResult();
    },
  });
  assert.equal(completed.profile, '001');
  assert.equal(completed.repository, 'owner/repository');
  assert.deepEqual(completed.branches, ['main', 'int']);
  assert.equal(completed.reviewBaseline, undefined);
  assert.deepEqual(completed.board, {
    owner: 'owner',
    number: 7,
    statusField: 'Status',
    statusMap: { 'go:yes': 'Ready', 'go:done': 'Done' },
  });
  assert.deepEqual(selected.slice(0, 3).map(({ label }) => label), [
    'Project type',
    'Default model for reqeng',
    'Default model for work',
  ]);
  assert.deepEqual(selected.slice(1, 4).map(({ label }) => label), [
    'Default model for reqeng',
    'Default model for work',
    'Default model for review',
  ]);
  assert.deepEqual(selected.slice(1, 4).map(({ current }) => current), [
    'mai-code-2',
    'claude-sonnet-5.5',
    'gpt-6.1-terra',
  ]);
  assert.ok(selected.slice(1, 4).every(({ choices }) => choices.every((choice) => VERIFIED_MODEL_FALLBACK.includes(choice))));
  assert.deepEqual(selected[4], {
    label: 'GitHub Project',
    choices: ['7 — Snake', '8 — Roadmap'],
    current: '7 — Snake',
  });
  assert.ok(!asked.some((label) => label.startsWith('Default model')));
  assert.equal(events[0], 'choose:Project type');
  assert.deepEqual(selected[0].choices, ['001 Typescript developer project']);
  assert.equal(completed.board.owner, 'owner');
  assert.ok(!asked.includes('Project owner'));
  assert.ok(!asked.includes('Project number'));
  assert.ok(ghCalls.some((call) => call.slice(1, 3).join(' ') === 'project list'));
  const firstPrompt = events.findIndex((event) => event.startsWith('ask:') || event.startsWith('choose:'));
  const promptAfterRepository = events.findIndex(
    (event, index) => index > firstPrompt && (event.startsWith('ask:') || event.startsWith('choose:'))
  );
  assert.equal(events[firstPrompt], 'choose:Project type');
  assert.ok(events.findIndex((event) => event === 'run:gh api user --jq .login') > firstPrompt);
  const repositoryPrompt = events.findIndex((event) => event === 'ask:GitHub repository (owner/name)');
  assert.ok(repositoryPrompt > 0);
  const nextPromptAfterRepository = events.findIndex(
    (event, index) => index > repositoryPrompt && (event.startsWith('ask:') || event.startsWith('choose:'))
  );
  assert.ok(events.findIndex((event) => event === 'run:gh api repos/owner/repository --jq .permissions')
    < nextPromptAfterRepository);
  assert.ok(events.findIndex((event) => event.startsWith('run:gh project list --owner owner'))
    < nextPromptAfterRepository);
  assert.equal(ghCalls.filter((call) => call.slice(1, 3).join(' ') === 'project list').length, 1);
});

test('missing Project scope stops before any wizard prompt or menu', async () => {
  let promptCalls = 0;
  let menuCalls = 0;
  const calls = [];
  await assert.rejects(() => completeInteractiveOptions({
    profile: '001',
    repository: 'owner/repository',
    language: 'en',
    branches: ['main'],
    models: { reqeng: 'mai-code-2', work: 'claude-sonnet-5.5', review: 'gpt-6.1-terra' },
    explicitModels: { reqeng: true, work: true, review: true },
    boardSync: false,
    board: {},
  }, null, async () => {
    promptCalls += 1;
    return '';
  }, async (_label, choices) => {
    menuCalls += 1;
    return choices[0];
  }, {
    spawn(command, args) {
      calls.push([command, ...args]);
      if (args[0] === 'auth') return commandResult("- Token scopes: 'repo', 'read:project'\n");
      if (args[0] === 'api' && args[1] === 'user') return commandResult('octocat\n');
      if (args[0] === 'api' && args[1].startsWith('repos/')) {
        return commandResult('{"pull":true,"push":true}\n');
      }
      if (args[0] === 'project' && args[1] === 'list') {
        return { status: 1, stdout: '', stderr: 'requires read:project scope' };
      }
      return commandResult();
    },
  }), (error) => error.details.category === 'project_scope');
  assert.equal(promptCalls, 0);
  assert.equal(menuCalls, 1);
  assert.deepEqual(calls.map((call) => call.slice(1, 3).join(' ')), [
    'auth status',
    'api user',
    'api repos/owner/repository',
  ]);
});

test('explicit full flags with board off preflight before the remaining prompt', async () => {
  const parsed = parseInstallArguments([
    '--repository', 'owner/repository',
    '--profile', '001',
    '--language', 'en',
    '--deployment-branches', '1',
    '--deployment-branch-1', 'main',
    '--model-reqeng', 'mai-code-2',
    '--model-work', 'claude-sonnet-5.5',
    '--model-review', 'gpt-6.1-terra',
    '--disable-board-sync',
  ]);
  const events = [];
  const completed = await completeInteractiveOptions(parsed, null, async (label, fallback) => {
    events.push(`ask:${label}`);
    return fallback;
  }, async (label, choices) => {
    events.push(`choose:${label}`);
    return choices[0];
  }, {
    spawn(command, args) {
        if (args[0] === 'auth') return commandResult("- Token scopes: 'repo', 'project'\n");
      events.push(`run:${command} ${args.join(' ')}`);
      if (command === 'copilot') return { status: 1, stdout: '', stderr: '' };
      if (args[0] === 'api' && args[1] === 'user') return commandResult('octocat\n');
      if (args[0] === 'api' && args[1].startsWith('repos/')) {
        return commandResult('{"pull":true,"push":true}\n');
      }
      if (args[0] === 'project' && args[1] === 'list') return commandResult('{"projects":[]}\n');
      return commandResult();
    },
  });
  assert.equal(completed.boardSync, false);
  assert.equal(events.some((event) => event === 'ask:Enable optional Project board sync (y/N)'), false);
  assert.deepEqual(events.filter((event) => event.startsWith('choose:')), ['choose:Project type']);
  const projectProbe = events.findIndex((event) => event.startsWith('run:gh project list --owner owner'));
  assert.ok(projectProbe >= 0);
  assert.ok(projectProbe < events.findIndex((event) => event.startsWith('ask:')));
});

test('interactive German model labels and discovery fallback are explicit', async () => {
  const labels = [];
  const output = [];
  const original = process.stdout.write;
  process.stdout.write = (chunk) => {
    output.push(String(chunk));
    return true;
  };
  try {
    await completeInteractiveOptions({
      profile: '001',
      repository: 'owner/repository',
      language: 'de',
      branches: ['main'],
      models: { reqeng: 'mai-code-2', work: 'claude-sonnet-5.5', review: 'gpt-6.1-terra' },
      explicitModels: {},
      boardSync: false,
      board: {},
    }, null, async (label, fallback) => label.startsWith('Enable') ? 'N' : fallback, async (label, choices, current) => {
      labels.push(label);
      return current;
    }, {
      spawn(command, args) {
        if (args[0] === 'auth') return commandResult("- Token scopes: 'repo', 'project'\n");
        if (command === 'copilot') return { status: 1, stdout: '', stderr: '' };
        if (args[0] === 'api' && args[1] === 'user') return commandResult('octocat\n');
        if (args[0] === 'api' && args[1].startsWith('repos/')) {
          return commandResult('{"pull":true,"push":true}\n');
        }
        if (args[0] === 'project' && args[1] === 'list') return commandResult('{"projects":[]}\n');
        return commandResult();
      },
    });
  } finally {
    process.stdout.write = original;
  }
  assert.deepEqual(labels, [
    'Project type',
    'Standardmodell für reqeng',
    'Standardmodell für work',
    'Standardmodell für review',
  ]);
  assert.match(output.join(''), /verifizierte Ersatz-Menü/u);
});

function pickerTerminal({ tty = true } = {}) {
  const input = new EventEmitter();
  const rawModes = [];
  input.isTTY = tty;
  input.isRaw = false;
  input.setRawMode = (enabled) => {
    rawModes.push(enabled);
    input.isRaw = enabled;
  };
  input.resume = () => {};
  const writes = [];
  const output = {
    isTTY: tty,
    write(chunk) {
      writes.push(String(chunk));
      return true;
    },
  };
  return { input, output, rawModes, writes };
}

test('arrow-key picker navigates, ignores numeric entry, confirms, and restores terminal state', async () => {
  const terminal = pickerTerminal();
  const selection = selectWithArrowKeys(
    'Default model for work',
    ['model-a', 'model-b', 'model-c'],
    'model-b',
    { ...terminal, emitKeypressEventsFn() {} }
  );

  terminal.input.emit('keypress', '3', { name: '3' });
  terminal.input.emit('keypress', '', { name: 'down' });
  terminal.input.emit('keypress', '', { name: 'return' });

  assert.equal(await selection, 'model-c');
  assert.deepEqual(terminal.rawModes, [true, false]);
  assert.equal(terminal.input.listenerCount('keypress'), 0);
  assert.equal(terminal.input.isRaw, false);
  assert.match(terminal.writes.join(''), /\x1B\[\?25l/u);
  assert.match(terminal.writes.join(''), /\x1B\[\?25h/u);
  assert.ok(terminal.writes.join('').includes('model-c'));
});

test('arrow-key picker supports j/k and cancellation aborts predictably', async () => {
  const terminal = pickerTerminal();
  const selected = selectWithArrowKeys('GitHub Project', ['one', 'two'], 'two', {
    ...terminal,
    language: 'en',
    emitKeypressEventsFn() {},
  });
  terminal.input.emit('keypress', 'k', { name: 'k' });
  terminal.input.emit('keypress', 'j', { name: 'j' });
  terminal.input.emit('keypress', '\r', { name: 'enter' });
  assert.equal(await selected, 'two');

  const cancelledTerminal = pickerTerminal();
  const cancelled = selectWithArrowKeys('GitHub Project', ['one', 'two'], 'one', {
    ...cancelledTerminal,
    emitKeypressEventsFn() {},
  });
  cancelledTerminal.input.emit('keypress', '', { name: 'escape' });
  await assert.rejects(cancelled, /Selection cancelled/u);
  assert.deepEqual(cancelledTerminal.rawModes, [true, false]);
  assert.equal(cancelledTerminal.input.listenerCount('keypress'), 0);
});

test('arrow-key picker fails closed when no TTY is available', () => {
  const terminal = pickerTerminal({ tty: false });
  assert.throws(
    () => selectWithArrowKeys('Default model for reqeng', ['model-a'], 'model-a', terminal),
    /--model-reqeng.*--model-work.*--model-review/u
  );
  assert.deepEqual(terminal.rawModes, []);
  assert.equal(terminal.writes.length, 0);
});

test('non-TTY startup performs repository preflight before model flag validation', () => {
  const result = spawnSync(process.execPath, [
    path.join(productRoot, 'scripts/install.mjs'),
    '--target', process.cwd(),
    '--repository', 'owner/repository',
    '--profile', '001',
    '--language', 'en',
    '--deployment-branches', '1',
    '--deployment-branch-1', 'main',
    '--dry-run',
  ], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Repository check failed/u);
  assert.doesNotMatch(result.stderr, /--model-reqeng.*--model-work.*--model-review/u);
  assert.doesNotMatch(result.stdout, /Select 1-/u);
});

test('GitHub preflight diagnoses host, auth and repository permission failures before writes', () => {
  const root = fixture();
  try {
    const failures = [
      [{ error: { code: 'ENOENT' }, status: null }, /`gh` is missing/u],
      [{ status: 1, stdout: '', stderr: '' }, /gh auth login/u],
    ];
    for (const [result, message] of failures) {
      assert.throws(() => buildInstallPlan(root, options, {
        spawn: () => result,
      }), message);
      assert.equal(existsSync(path.join(root, '.squad/heroes.json')), false);
    }
    let call = 0;
    assert.throws(() => assertGithubWriteAccess('owner/repository', {
      spawn: () => {
        call += 1;
        if (call === 2) return commandResult('octocat\n');
        if (call === 3) return commandResult('{"pull":false,"push":true}\n');
        return commandResult();
      },
    }), /Repository read access/u);
    call = 0;
    assert.throws(() => assertGithubWriteAccess('owner/repository', {
      spawn: () => {
        call += 1;
        if (call === 2) return commandResult('octocat\n');
        if (call === 3) return commandResult('{"pull":true,"push":false}\n');
        return commandResult();
      },
    }), /push access is false/u);
  } finally {
    cleanup(root);
  }
});

test('board project resolution derives owner and handles one, many, zero and inaccessible projects', async () => {
  const list = (projects, viewStatus = 0) => (command, args) => {
    if (args[0] === 'project' && args[1] === 'list') {
      return commandResult(JSON.stringify({ projects }));
    }
    if (args[0] === 'project' && args[1] === 'view') {
      return viewStatus === 0
        ? commandResult(JSON.stringify({ number: Number(args[2]) }))
        : { status: viewStatus, stdout: '', stderr: '' };
    }
    return commandResult();
  };
  const board = {};
  resolveBoardProject('dakoenig/squad-heroes-snake', board, {
    spawn: list([{ number: 4, title: 'Delivery' }]),
  });
  assert.deepEqual(board, { owner: 'dakoenig', number: 4 });

  assert.throws(() => resolveBoardProject('owner/repository', {}, {
    spawn: list([{ number: 1 }, { number: 2 }]),
  }), /Multiple GitHub Projects/u);
  assert.throws(() => resolveBoardProject('owner/repository', {}, {
    spawn: list([]),
  }), /No GitHub Project/u);
  assert.throws(() => resolveBoardProject('owner/repository', { number: 4 }, {
    spawn: list([], 1),
  }), /Project access failed/u);
  assert.throws(() => resolveBoardProject('owner/repository', { owner: 'other', number: 4 }), /derived/u);
});

test('multiple discovered Projects are selected only through the interactive picker', async () => {
  const selections = [];
  const completed = await completeInteractiveOptions({
    profile: '001',
    repository: 'owner/repository',
    language: 'en',
    branches: ['main'],
    models: { reqeng: 'mai-code-2', work: 'claude-sonnet-5.5', review: 'gpt-6.1-terra' },
    explicitModels: {},
    boardSync: true,
    board: {
      statusField: 'Status',
      statusMap: { 'go:yes': 'Ready' },
    },
  }, null, async (label, fallback) => fallback, async (label, choices, current) => {
    selections.push({ label, choices, current });
    return label === 'GitHub Project' ? choices[1] : current;
  }, {
    spawn(command, args) {
        if (args[0] === 'auth') return commandResult("- Token scopes: 'repo', 'project'\n");
      if (command === 'copilot') return { status: 1, stdout: '', stderr: '' };
      if (args[0] === 'api' && args[1] === 'user') return commandResult('octocat\n');
      if (args[0] === 'api' && args[1].startsWith('repos/')) {
        return commandResult('{"pull":true,"push":true}\n');
      }
      if (args[0] === 'project' && args[1] === 'list') {
        return commandResult(JSON.stringify({
          projects: [{ number: 1, title: 'Roadmap' }, { number: 2, title: 'Delivery' }],
        }));
      }
      if (args[0] === 'project' && args[1] === 'view') {
        return commandResult(JSON.stringify({ number: 2, title: 'Delivery' }));
      }
      return commandResult('true\n');
    },
  });
  assert.equal(completed.board.number, 2);
  assert.equal(completed.board.owner, 'owner');
  assert.deepEqual(selections.at(-1).choices, ['1 — Roadmap', '2 — Delivery']);
});

test('dry-run board opt-in uses only read checks and writes no active targets', () => {
  const root = fixture();
  try {
    const calls = [];
    const boardOptions = {
      ...options,
      boardSync: true,
      board: {
        owner: 'owner',
        number: 7,
        statusField: 'Status',
        statusMap: { 'go:yes': 'Ready', 'go:done': 'Done' },
      },
    };
    const injected = {
      spawn(command, args) {
        if (args[0] === 'auth') return commandResult("- Token scopes: 'repo', 'project'\n");
        calls.push([command, ...args]);
        if (args[0] === 'api' && args[1] === 'user') return commandResult('octocat\n');
        if (args[0] === 'project' && args[1] === 'view') {
          return commandResult(JSON.stringify({ number: 7 }));
        }
        if (args[0] === 'project' && args[1] === 'list') {
          return commandResult(JSON.stringify({
            projects: [{ number: 7, title: 'Snake', owner: { type: 'User' } }],
          }));
        }
        if (args[0] === 'project' && args[1] === 'field-list') {
          return commandResult('{"fields":[{"id":"F7","name":"Status","options":[{"name":"Ready"},{"name":"Done"}]}]}\n');
        }
        if (args[0] === 'api' && args[1].startsWith('repos/')) {
          return commandResult('{"pull":true,"push":true}\n');
        }
        if (args[0] === 'api' && args[1] === 'graphql') {
          return commandResult('{"data":{"user":{"projectV2":{"id":"P7","number":7,"viewerCanUpdate":true}}}}\n');
        }
        return commandResult();
      },
    };
    const plan = buildInstallPlan(root, boardOptions, injected);
    const result = applyPlan(root, plan, { dryRun: true }, injected);
    assert.equal(result.changed, 0);
    assert.equal(existsSync(path.join(root, '.squad/heroes.json')), false);
    assert.equal(existsSync(path.join(root, 'scripts/start-work.mjs')), false);
    assert.ok(calls.filter(([command]) => command === 'gh').every((call) => {
      const joined = call.join(' ');
      return !/\b(item-add|item-edit|field-create|label create)\b/u.test(joined);
    }));
  } finally {
    cleanup(root);
  }
});

test('Project access failure blocks board installation before its first write', () => {
  const root = fixture();
  try {
    assert.throws(() => buildInstallPlan(root, {
      ...options,
      boardSync: true,
      board: { number: 9, statusField: 'Status', statusMap: { 'go:yes': 'Ready' } },
    }, {
      spawn(command, args) {
        if (args[0] === 'auth') return commandResult("- Token scopes: 'repo', 'project'\n");
        if (args[0] === 'api' && args[1] === 'user') return commandResult('octocat\n');
        if (args[0] === 'project' && args[1] === 'list') return commandResult('{"projects":[]}\n');
        if (args[0] === 'project' && args[1] === 'field-list') {
          return commandResult('{"fields":[{"id":"F9","name":"Status","options":[{"name":"Ready"}]}]}\n');
        }
        if (args[0] === 'project' && args[1] === 'view') {
          return { status: 1, stdout: '', stderr: 'forbidden' };
        }
        if (args[0] === 'api' && args[1].startsWith('repos/')) {
          return commandResult('{"pull":true,"push":true}\n');
        }
        return commandResult();
      },
    }), /Project access failed/u);
    assert.equal(existsSync(path.join(root, '.squad/heroes.json')), false);
  } finally {
    cleanup(root);
  }
});

test('mutating board installation rechecks Project access immediately before writes', () => {
  const root = fixture();
  let views = 0;
  let denyProject = false;
  let permissionChecks = 0;
  const gate = {
    spawn(command, args) {
        if (args[0] === 'auth') return commandResult("- Token scopes: 'repo', 'project'\n");
      if (args[0] === 'api' && args[1] === 'user') return commandResult('octocat\n');
      if (args[0] === 'api' && args[1].startsWith('repos/')) {
        return commandResult('{"pull":true,"push":true}\n');
      }
      if (args[0] === 'project' && args[1] === 'list') return commandResult('{"projects":[]}\n');
      if (args[0] === 'project' && args[1] === 'field-list') {
        return commandResult('{"fields":[{"id":"F9","name":"Status","options":[{"name":"Ready"}]}]}\n');
      }
      if (args[0] === 'project' && args[1] === 'view') {
        views += 1;
        return denyProject
          ? { status: 1, stdout: '', stderr: 'forbidden' }
          : commandResult(JSON.stringify({ number: 9, owner: { type: 'User' } }));
      }
      if (args[0] === 'api' && args[1] === 'graphql') {
        permissionChecks += 1;
        return denyProject
          ? { status: 0, stdout: '{"data":{"user":{"projectV2":null}}}\n', stderr: '' }
          : commandResult('{"data":{"user":{"projectV2":{"id":"P9","number":9,"viewerCanUpdate":true}}}}\n');
      }
      return commandResult();
    },
  };
  try {
    const plan = buildInstallPlan(root, {
      ...options,
      boardSync: true,
      board: {
        number: 9,
        statusField: 'Status',
        statusMap: { 'go:yes': 'Ready' },
      },
    }, gate);
    denyProject = true;
    assert.throws(() => applyPlan(root, plan, {}, gate), /Project access failed|write access could not be verified|not found/u);
    assert.equal(views, 3);
    assert.equal(permissionChecks, 1);
    assert.equal(existsSync(path.join(root, '.squad/heroes.json')), false);
  } finally {
    cleanup(root);
  }
});

test('Project board activation verifies write rights before any file mutation', () => {
  const root = fixture();
  let writes = 0;
  const gate = {
    spawn(command, args) {
      if (args[0] === 'auth') return commandResult("- Token scopes: 'project'\n");
      if (args[0] === 'api' && args[1] === 'user') return commandResult('octocat\n');
      if (args[0] === 'api' && args[1].startsWith('repos/')) {
        return commandResult('{"pull":true,"push":true}\n');
      }
      if (args[0] === 'project' && args[1] === 'list') return commandResult('{"projects":[]}\n');
      if (args[0] === 'project' && args[1] === 'view') {
        return commandResult('{"number":9,"owner":{"type":"Organization"}}\n');
      }
      if (args[0] === 'api' && args[1] === 'graphql') {
        writes += 1;
        return commandResult(JSON.stringify({
          data: { organization: { projectV2: { id: 'P1', number: 9, viewerCanUpdate: false } } },
        }));
      }
      return commandResult();
    },
  };
  try {
    assert.throws(() => buildInstallPlan(root, {
      ...options,
      boardSync: true,
      board: {
        number: 9,
        statusField: 'Status',
        statusMap: { 'go:yes': 'Ready' },
      },
    }, gate), (error) => {
      assert.match(error.message, /403/iu);
      assert.match(error.message, /Project owner\/admin/u);
      return true;
    });
    assert.equal(writes, 1);
    assert.equal(existsSync(path.join(root, '.squad/heroes.json')), false);
  } finally {
    cleanup(root);
  }
});

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
    assert.ok(plan.operations.some((entry) => entry.target === '.squad/001/profile.json'));
    assert.ok(plan.operations.some((entry) => entry.target === '.squad/001/agents/tony.en.md'));
    assert.ok(plan.operations.some((entry) => entry.target === '.squad/001/skills/humanizer/en-US.md'));
    assert.equal(plan.operations.filter((entry) => entry.target === 'scripts/start-work.mjs').length, 1);
    assert.equal(plan.operations.filter((entry) => entry.target.startsWith('.squad/001/scripts/')).length, 0);
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
      printPlan(plan, 'en', { dryRun: true });
    } finally {
      process.stdout.write = originalWrite;
    }
    const output = writes.join('');
    assert.match(output, /activation plan/u);
    assert.match(output, /complete versioned distribution/u);
    assert.match(output, /scripts\/start-work\.mjs/u);
    assert.match(output, /\.github\/workflows\/heroes-ci\.yml/u);
    assert.match(output, /Dry-run: no files or remote resources changed/u);
    assert.match(output, /Files to add \(\d+\)/u);
    assert.match(output, /Existing files to merge/u);
    assert.doesNotMatch(output, /\[\s*\n\s*\{/u);
    assert.doesNotMatch(output, /\\n/u);
    assert.doesNotMatch(output, /actionDetails|owner/u);
    assert.ok(machinePlan(plan).length > 0);
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
    assert.ok(existsSync(path.join(root, '.squad/001/profile.json')));
    assert.ok(existsSync(path.join(root, '.squad/001/agents/tony/charter.en.md')) === false);
    assert.ok(existsSync(path.join(root, '.squad/001/agents/tony.en.md')));
    assert.ok(existsSync(path.join(root, '.squad/001/skills/humanizer/en-US.md')));
    const installedScriptTargets = parseJsonFile(
      path.join(productRoot, '.squad/heroes/companion-targets.json')
    ).targets
      .filter(({ target, extension }) => !extension && /^scripts\/.+\.mjs$/u.test(target))
      .map(({ target }) => target);
    for (const target of installedScriptTargets) {
      assert.ok(existsSync(path.join(root, target)), `missing installed script: ${target}`);
    }
    const state = JSON.parse(readFileSync(path.join(root, '.squad/heroes.json'), 'utf8'));
    assert.equal(state.profile, '001');
    const rerun = applyPlan(root, buildInstallPlan(root, options, injected), {}, injected);
    assert.equal(rerun.changed, 0);
  } finally {
    cleanup(root);
  }
});

test('existing legacy state migrates once to profile 001 without profile drift', () => {
  const root = fixture();
  try {
    const legacy = {
      schemaVersion: 1,
      product: 'squad-heroes',
      profile: 'typescript-development',
      deploymentBranches: ['main'],
      language: 'en',
      modelDefaults: options.models,
      repository: options.repository,
      managed: 'squad-heroes',
      recovery: { planVersion: 1, lastCompletedPlan: null },
      extensions: {},
    };
    write(root, '.squad/heroes.json', `${JSON.stringify(legacy, null, 2)}\n`);
    const plan = buildInstallPlan(root, {
      ...options,
      repository: legacy.repository,
      profile: '001',
      branches: legacy.deploymentBranches,
      language: legacy.language,
    }, injected);
    assert.equal(plan.config.profile, '001');
    const stateOperation = plan.operations.find(({ target }) => target === '.squad/heroes.json');
    assert.match(stateOperation.content, /"profile": "001"/u);
    assert.doesNotMatch(stateOperation.content, /typescript-development/u);
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
    assert.throws(() => applyPlan(root, plan, {}, injected), /unresolved conflicts.*--decisions/u);
    assert.equal(existsSync(path.join(root, '.squad/heroes.json')), false);
  } finally {
    cleanup(root);
  }
});

test('interactive picker resolves fresh markerless team and routing, then safely replans Project #3', async () => {
  const root = fixture();
  try {
    const originalTeam = '# Local Squad team\r\nAlice owns this roster.\r\n';
    const originalRouting = '# Local routing\nKeep this exact routing preface.\n';
    write(root, '.squad/team.md', originalTeam);
    write(root, '.squad/routing.md', originalRouting);
    const projectCalls = [];
    const boardInjected = {
      spawn(command, args) {
        if (args[0] === 'auth') return commandResult("- Token scopes: 'repo', 'project'\n");
        if (args[0] === 'api' && args[1] === 'user') return commandResult('octocat\n');
        if (args[0] === 'api' && args[1].startsWith('repos/')) {
          return commandResult('{"pull":true,"push":true,"admin":false}\n');
        }
        if (args[0] === 'project' && args[1] === 'list') {
          return commandResult('{"projects":[{"number":3,"title":"Heroes","owner":{"type":"User"}}]}\n');
        }
        if (args[0] === 'project' && args[1] === 'view') {
          return commandResult('{"number":3,"title":"Heroes"}\n');
        }
        if (args[0] === 'project' && args[1] === 'field-list') {
          return commandResult('{"fields":[{"id":"F3","name":"Status","options":[{"id":"O1","name":"Ready"},{"id":"O2","name":"Done"}]}]}\n');
        }
        if (args[0] === 'api' && args[1] === 'graphql') {
          projectCalls.push([command, ...args]);
          const query = args.find((arg) => arg.startsWith('query=')) ?? args[2] ?? '';
          if (query.includes('repositoryOwner(login:')) {
            return commandResult('{"data":{"repositoryOwner":{"id":"O1","login":"owner","__typename":"User","isViewer":true}}}\n');
          }
          if (query.includes('repository(owner:')) {
            return commandResult('{"data":{"repository":{"id":"R1"}}}\n');
          }
          if (query.includes('repositories(first:100)')) {
            return commandResult('{"data":{"node":{"repositories":{"nodes":[{"id":"R1"}]}}}}\n');
          }
          return commandResult('{"data":{"user":{"projectV2":{"id":"P3","number":3,"viewerCanUpdate":true}}}}\n');
        }
        return commandResult();
      },
    };
    const boardOptions = {
      ...options,
      boardSync: true,
      board: {
        owner: 'owner',
        number: 3,
        statusField: 'Status',
        statusMap: { 'go:yes': 'Ready', 'go:done': 'Done' },
      },
    };
    const first = buildInstallPlan(root, boardOptions, boardInjected);
    assert.deepEqual(first.conflicts.map(({ target }) => target), [
      '.squad/team.md',
      '.squad/routing.md',
    ]);
    assert.ok(first.conflicts.every(({ recommendation }) => recommendation === 'merge'));
    assert.ok(first.operations.some(({ target, externalAction, actionDetails }) =>
      target === 'github-project:owner/#3' &&
      externalAction === 'configure-project-schema' &&
      actionDetails.number === 3
    ));

    const selected = [];
    const output = { write: (chunk) => {
      selected.push(String(chunk));
      return true;
    } };
    const decisions = await resolveConflictDecisions(first, async (label, choices, current) => {
      selected.push(`${label}:${choices.join(',')}:${current}`);
      return 'merge';
    }, { language: 'en', output });
    assert.deepEqual(decisions, {
      '.squad/team.md': 'merge',
      '.squad/routing.md': 'merge',
    });
    assert.equal(selected.filter((entry) => entry.startsWith('Selected ')).length, 2);
    assert.ok(selected.some((entry) => entry.includes('Recommended: merge')));
    assert.ok(selected.some((entry) => entry.includes('Merge — recommended: add to the existing file')));
    assert.ok(selected.some((entry) => entry.includes('Show details / diff')));
    assert.ok(selected.some((entry) => entry.endsWith(':Merge — recommended: add to the existing file')));
    assert.ok(selected.join('\n').includes('local roster') === false);

    const resolved = buildInstallPlan(
      root,
      { ...boardOptions, decisions },
      boardInjected
    );
    assert.equal(resolved.conflicts.length, 0);
    assert.deepEqual(resolved.config.recovery.decisions, decisions);
    assert.equal(applyPlan(root, resolved, { dryRun: true }, boardInjected).changed, 0);
    assert.equal(readFileSync(path.join(root, '.squad/team.md'), 'utf8'), originalTeam);
    assert.equal(existsSync(path.join(root, '.squad/heroes.json')), false);
    assert.equal(projectCalls.some((call) => call.join(' ').match(/\b(link|mutation)\b/u) && !call.join(' ').includes('repositories(first:100)')), false);

    applyPlan(root, resolved, {}, boardInjected);
    const installedTeam = readFileSync(path.join(root, '.squad/team.md'), 'utf8');
    const installedRouting = readFileSync(path.join(root, '.squad/routing.md'), 'utf8');
    assert.ok(installedTeam.startsWith(originalTeam));
    assert.ok(installedRouting.startsWith(originalRouting));
    assert.match(installedTeam, /<!-- squad-heroes:team:begin/u);
    assert.match(installedRouting, /<!-- squad-heroes:routing:begin/u);
    const state = JSON.parse(readFileSync(path.join(root, '.squad/heroes.json'), 'utf8'));
    assert.equal(state.extensions['board-sync'].number, 3);
    assert.deepEqual(state.recovery.decisions, decisions);
  } finally {
    cleanup(root);
  }
});

test('German conflict help is natural, recommends merge, and bounds opt-in details', async () => {
  const incoming = `<!-- squad-heroes:team:begin -->
## Members

| Name | Role |
| --- | --- |
| Tony | Lead Architekt |
<!-- squad-heroes:team:end -->
`;
  const plan = {
    config: { recovery: {} },
    conflicts: [{
      target: '.squad/team.md',
      mode: 'managed-section',
      section: 'team',
      action: 'conflict',
      before: 'lokaler Inhalt\r\n',
      base: '',
      incoming,
      options: ['use', 'keep', 'merge', 'abort'],
      recommendation: 'merge',
    }],
  };
  const output = [];
  let call = 0;
  const decisions = await resolveConflictDecisions(plan, async (_label, choices, current) => {
    call += 1;
    assert.equal(current, 'Zusammenführen – empfohlen: vorhandene Datei ergänzen');
    assert.ok(choices.includes('Details / Diff anzeigen'));
    return call === 1 ? 'Details / Diff anzeigen' : current;
  }, {
    language: 'de',
    output: { write: (chunk) => output.push(String(chunk)) },
  });
  const rendered = output.join('');
  assert.deepEqual(decisions, { '.squad/team.md': 'merge' });
  assert.match(rendered, /In \.squad\/team\.md ist noch keine verwaltete Squad-Heroes-Teamsektion vorhanden/u);
  assert.match(rendered, /Agenten Tony/u);
  assert.match(rendered, /Empfehlung: Zusammenführen – empfohlen/u);
  assert.match(rendered, /Basis: 0 Zeilen/u);
  assert.doesNotMatch(rendered, /actionDetails|owner|\\n/u);
  assert.ok(rendered.length < 2500);
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
