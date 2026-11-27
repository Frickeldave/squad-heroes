import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { applyPlan, buildInstallPlan, parseInstallArguments } from '../src/installer.mjs';
import { completeInteractiveOptions } from '../scripts/install.mjs';
import { validateProjectTitle } from '../src/preflight.mjs';
import { cleanup, commandResult, fixture } from './helpers.mjs';

const base = {
  repository: 'frickeldave-test/squad-heroes-snake',
  profile: 'typescript-development',
  language: 'en',
  branches: ['main'],
  models: { reqeng: 'mai-code-2', work: 'claude-sonnet-5.5', review: 'gpt-6.1-terra' },
  explicitModels: { reqeng: true, work: true, review: true },
  boardSync: true,
  boardSyncExplicit: true,
  createProject: true,
  createProjectApproved: true,
  projectTitle: 'squad-heroes-snake',
  board: {
    statusField: 'Status',
    statusMap: { 'go:yes': 'Ready', 'go:done': 'Done' },
    secret: 'secrets.HEROES_PROJECT_TOKEN',
  },
};

function githubFixture({ projects = [], denyCreate = false, failAfterCreate = false } = {}) {
  const calls = [];
  let created = false;
  const spawn = (command, args, options = {}) => {
    calls.push({ command, args, options });
    if (args[0] === 'auth') return commandResult("- Token scopes: 'repo', 'project'\n");
    if (args[0] === 'api' && args[1] === 'user') return commandResult('octocat\n');
    if (args[0] === 'api' && String(args[1]).startsWith('repos/')) return commandResult('{"id":123,"pull":true,"push":true}\n');
    if (args[0] === 'project' && args[1] === 'list') {
      return commandResult(JSON.stringify({ projects: created ? [{ number: 42, title: 'squad-heroes-snake' }] : projects }));
    }
    if (args[0] === 'project' && args[1] === 'view') return commandResult('{"number":42,"id":"P42"}\n');
    if (args[0] === 'api' && args[1] === 'graphql') {
      const text = args.join(' ');
      if (text.includes('isViewer')) {
        return commandResult(JSON.stringify({ data: { organization: null, user: {
          id: 'U_OWNER', login: 'frickeldave-test', __typename: 'User', isViewer: !denyCreate,
        } } }));
      }
      if (text.includes('createProjectV2')) {
        created = true;
        return commandResult(JSON.stringify({ data: { createProjectV2: { projectV2: {
          id: 'P42', number: 42, title: 'squad-heroes-snake', viewerCanUpdate: true,
        } } } }));
      }
      if (text.includes('projectV2(number:')) return commandResult(JSON.stringify({ data: { user: { projectV2: { id: 'P42', viewerCanUpdate: true } } } }));
      if (text.includes('repository(owner:')) return commandResult('{"data":{"repository":{"id":"R123"}}}\n');
      if (text.includes('repositories(first:100)')) return commandResult('{"data":{"node":{"repositories":{"nodes":[]}}}}\n');
      if (text.includes('linkProjectV2ToRepository')) return commandResult('{"data":{"linkProjectV2ToRepository":{"clientMutationId":"1"}}}\n');
      if (text.includes('updateProjectV2Field')) return commandResult('{"data":{"updateProjectV2Field":{"projectV2Field":{"id":"F1"}}}}\n');
    }
    if (args[0] === 'project' && args[1] === 'field-list') return commandResult('{"fields":[]}\n');
    if (args[0] === 'project' && args[1] === 'field-create') {
      if (failAfterCreate) return { status: 1, stdout: '', stderr: 'schema unavailable' };
      return commandResult('{"id":"F1"}\n');
    }
    return commandResult();
  };
  return { spawn, calls };
}

test('zero Project dry-run plans explicit create and all follow-up operations without mutation', () => {
  const root = fixture();
  const gh = githubFixture();
  try {
    const plan = buildInstallPlan(root, structuredClone(base), gh);
    const result = applyPlan(root, plan, { dryRun: true }, gh);
    assert.equal(result.changed, 0);
    assert.ok(plan.projectCreate);
    assert.equal(plan.projectCreate.owner, 'frickeldave-test');
    assert.equal(plan.projectCreate.title, 'squad-heroes-snake');
    assert.equal(plan.projectCreate.ownerType, 'User');
    assert.deepEqual(plan.operations.filter((op) => op.mode === 'external').map((op) => op.externalAction), [
      'create-project', 'configure-project-schema', 'link-repository',
    ]);
    assert.match(JSON.stringify(result.plan), /\{\{PROJECT_NUMBER\}\}/u);
    assert.equal(existsSync(path.join(root, '.squad/heroes.json')), false);
    assert.equal(gh.calls.filter(({ args }) => args.join(' ').includes('createProjectV2')).length, 0);
  } finally { cleanup(root); }
});

test('apply creates once, resolves number, configures and persists recovery state', () => {
  const root = fixture();
  const gh = githubFixture();
  try {
    const plan = buildInstallPlan(root, structuredClone(base), gh);
    applyPlan(root, plan, {}, gh);
    const config = JSON.parse(readFileSync(path.join(root, '.squad/heroes.json'), 'utf8'));
    assert.equal(config.extensions['board-sync'].number, 42);
    assert.equal(config.recovery.planVersion, 1);
    assert.equal(gh.calls.filter(({ args }) => args.join(' ').includes('createProjectV2')).length, 1);
    const mutationIndex = gh.calls.findIndex(({ args }) => args.join(' ').includes('createProjectV2'));
    assert.ok(gh.calls.findIndex(({ args }) => args[1] === 'field-create') > mutationIndex);
    const rerunOptions = { ...structuredClone(base), createProject: false, createProjectApproved: false, projectTitle: null };
    const rerunPlan = buildInstallPlan(root, rerunOptions, gh); const rerun = applyPlan(root, rerunPlan, {}, gh);
    assert.equal(gh.calls.filter(({ args }) => args.join(' ').includes('createProjectV2')).length, 1);
    assert.equal(rerun.changed, 0); 
  } finally { cleanup(root); }
});

test('cancel and missing approval cause no Project or local mutation', async () => {
  const root = fixture();
  const gh = githubFixture();
  try {
    await assert.rejects(() => completeInteractiveOptions({ ...structuredClone(base), createProject: false, projectTitle: null }, null,
      async (label, fallback) => label.includes('owner') ? 'N' : fallback,
      async (label, choices) => label.includes('No GitHub') ? choices[1] : choices[0], gh), /cancelled/iu);
    const plan = buildInstallPlan(root, { ...structuredClone(base), createProjectApproved: false }, gh);
    assert.throws(() => applyPlan(root, plan, {}, gh), /explicitly approve/u);
    assert.equal(gh.calls.filter(({ args }) => args.join(' ').includes('createProjectV2')).length, 0);
    assert.equal(existsSync(path.join(root, '.squad/heroes.json')), false);
  } finally { cleanup(root); }
});

test('denied create and partial schema failure fail closed with recovery guidance', () => {
  const denied = fixture();
  const deniedGh = githubFixture({ denyCreate: true });
  try {
    assert.throws(() => buildInstallPlan(denied, structuredClone(base), deniedGh), /403|grant Project creation/u);
    assert.equal(deniedGh.calls.filter(({ args }) => args.join(' ').includes('createProjectV2')).length, 0);
  } finally { cleanup(denied); }
  const partial = fixture();
  const partialGh = githubFixture({ failAfterCreate: true });
  try {
    const plan = buildInstallPlan(partial, structuredClone(base), partialGh);
    assert.throws(() => applyPlan(partial, plan, {}, partialGh), /partially|schema|field|recover/iu);
    assert.equal(partialGh.calls.filter(({ args }) => args.join(' ').includes('createProjectV2')).length, 1);
    assert.equal(existsSync(path.join(partial, '.squad/heroes.json')), false);
  } finally { cleanup(partial); }
});

test('noninteractive zero-Project mode requires unambiguous create flags', () => {
  const root = fixture();
  const gh = githubFixture();
  try {
    assert.throws(() => buildInstallPlan(root, { ...structuredClone(base), createProject: false }, gh), /--create-project.*--project-title/u);
    assert.throws(() => parseInstallArguments(['--create-project=true']), /Unknown argument/u);
    for (const title of ['', ' project ', 'Project', 'untitled', 'x'.repeat(121), 'a\nb']) {
      assert.throws(() => validateProjectTitle(title), /Project title/u);
    }
  } finally { cleanup(root); }
});

test('Project commands never emit token values and explicit existing numbers keep working', () => {
  const root = fixture();
  const gh = githubFixture({ projects: [{ number: 7, title: 'Existing' }] });
  try {
    const options = { ...structuredClone(base), createProject: false, createProjectApproved: false, projectTitle: null, board: { ...base.board, number: 7 } };
    const plan = buildInstallPlan(root, options, gh);
    assert.equal(plan.projectCreate, null);
    assert.equal(plan.operations.some((op) => op.externalAction === 'create-project'), false);
    const serialized = JSON.stringify(gh.calls);
    assert.doesNotMatch(serialized, /GH_TOKEN|ghp_|token=/u);
  } finally { cleanup(root); }
});
