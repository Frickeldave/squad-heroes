import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { applyPlan, buildInstallPlan, parseInstallArguments } from '../src/installer.mjs';
import { completeInteractiveOptions } from '../scripts/install.mjs';
import { resolveProjectOwnerForCreate, validateProjectTitle } from '../src/preflight.mjs';
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
  },
};

function githubFixture({
  projects = [],
  denyCreate = false,
  failCreate = false,
  failAfterCreate = false,
  missingAfterCreate = false,
} = {}) {
  const calls = [];
  let created = false;
  const spawn = (command, args, options = {}) => {
    calls.push({ command, args, options });
    if (args[0] === 'auth') return commandResult("- Token scopes: 'repo', 'project'\n");
    if (args[0] === 'api' && args[1] === 'user') return commandResult('octocat\n');
    if (args[0] === 'api' && String(args[1]).startsWith('repos/')) return commandResult('{"id":123,"pull":true,"push":true}\n');
    if (args[0] === 'project' && args[1] === 'list') {
      return commandResult(JSON.stringify({
        projects: created
          ? [{ number: 42, title: 'squad-heroes-snake', owner: { type: 'User' } }]
          : projects.map((project) => ({ ...project, owner: project.owner ?? { type: 'User' } })),
      }));
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
        if (failCreate) return { status: 1, stdout: '', stderr: 'creation failed' };
        created = true;
        return commandResult(JSON.stringify({ data: { createProjectV2: { projectV2: {
          id: 'P42', number: 42, title: 'squad-heroes-snake', viewerCanUpdate: true,
        } } } }));
      }
      if (text.includes('projectV2(number:')) {
        const requested = Number(args.find((arg) => arg.startsWith('number='))?.slice(7) ?? 42);
        return commandResult(JSON.stringify({
        data: { user: { projectV2: missingAfterCreate ? null : {
          id: `P${requested}`, number: requested, viewerCanUpdate: true,
        } } },
        }));
      }
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

test('Project creation owner resolution accepts user and organization partial GraphQL output', () => {
  for (const item of [
    ['User', 'user', 'organization', 'Organization', true, undefined],
    ['Organization', 'organization', 'user', 'User', undefined, true],
  ]) {
    const [type, branch, opposite, oppositeName, isViewer, viewerCanAdminister] = item;
    const identity = {
      id: `${type}_OWNER`,
      login: 'frickeldave-test',
      __typename: type,
      ...(isViewer !== undefined ? { isViewer } : {}),
      ...(viewerCanAdminister !== undefined ? { viewerCanAdminister } : {}),
    };
    const result = resolveProjectOwnerForCreate('frickeldave-test/repository', 'fixture', {
      authentication: {
        account: 'frickeldave-test',
        projectScope: true,
        scopes: ['project'],
      },
      spawn: () => ({
        status: 1,
        stdout: JSON.stringify({
          data: { [opposite]: null, [branch]: identity },
          errors: [{
            type: 'NOT_FOUND',
            path: [opposite],
            message: `Could not resolve to a ${oppositeName} with the login of 'frickeldave-test'.`,
          }],
        }),
        stderr: `gh: Could not resolve to a ${oppositeName} with the login of 'frickeldave-test'.`,
      }),
    });
    assert.equal(result.ownerType, type);
    assert.equal(result.ownerId, `${type}_OWNER`);
  }
});

test('Project creation owner resolution rejects auth errors despite valid partial data', () => {
  assert.throws(() => resolveProjectOwnerForCreate('frickeldave-test/repository', 'fixture', {
    authentication: {
      account: 'frickeldave-test',
      projectScope: true,
      scopes: ['project'],
    },
    spawn: () => ({
      status: 1,
      stdout: JSON.stringify({
        data: { user: {
          id: 'U_OWNER',
          login: 'frickeldave-test',
          __typename: 'User',
          isViewer: true,
        } },
        errors: [{ type: 'FORBIDDEN', path: ['user'], message: 'Bad credentials' }],
      }),
      stderr: 'Bad credentials',
    }),
  }), /GitHub Project access failed/u);
});

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
    assert.equal(plan.projectState, 'PLANNED_CREATE');
    const external = plan.operations.filter((op) => op.mode === 'external');
    assert.ok(external.every((op) => op.actionDetails.state === 'PLANNED_CREATE'));
    assert.ok(external.filter((op) => op.externalAction !== 'create-project')
      .every((op) => op.actionDetails.deferred === true));
    assert.equal(gh.calls.filter(({ args }) => args[0] === 'project' && args[1] === 'view').length, 0);
  } finally { cleanup(root); }
});

test('explicit zero Project flags use safe schema defaults during dry-run', () => {
  const root = fixture();
  const gh = githubFixture();
  try {
    const options = parseInstallArguments([
      '--repository', base.repository,
      '--profile', base.profile,
      '--language', 'en',
      '--deployment-branches', '1',
      '--deployment-branch-1', 'main',
      '--enable-board-sync',
      '--model-reqeng', base.models.reqeng,
      '--model-work', base.models.work,
      '--model-review', base.models.review,
      '--create-project',
      '--project-title', base.projectTitle,
      '--dry-run',
    ]);
    const plan = buildInstallPlan(root, options, gh);
    const result = applyPlan(root, plan, { dryRun: true }, gh);
    assert.equal(result.changed, 0);
    assert.equal(plan.config.extensions['board-sync'].statusField, 'Status');
    assert.deepEqual(plan.config.extensions['board-sync'].statusMap, {
      'go:yes': 'Ready',
      'go:done': 'Done',
    });
  } finally { cleanup(root); }
});

test('zero Project interactive flow collects planned config without a token prompt', async () => {
  const root = fixture();
  const gh = githubFixture();
  const asked = [];
  const answers = new Map([
    ['Project status field', 'Status'],
    ['Project status map JSON', JSON.stringify(base.board.statusMap)],
  ]);
  try {
    const options = await completeInteractiveOptions({
      ...structuredClone(base),
      projectTitle: null,
      createProject: false,
      createProjectApproved: false,
      board: {},
    }, null, async (label, fallback) => {
      asked.push(label);
      if (label.includes('owner') && label.includes('frickeldave-test')) return 'y';
      return answers.get(label) ?? fallback;
    }, async (_label, choices) => choices[0], gh);
    assert.ok(gh.calls.some(({ args }) => args[0] === 'project' && args[1] === 'list'));
    assert.ok(asked.every((label) => !/(token|secret)/iu.test(label)));
    const plan = buildInstallPlan(root, options, gh);
    const result = applyPlan(root, plan, { dryRun: true }, gh);
    assert.equal(result.changed, 0);
    assert.equal(plan.projectState, 'PLANNED_CREATE');
    assert.equal(gh.calls.some(({ args }) => args[0] === 'project' && args[1] === 'view'), false);
    assert.ok(plan.operations.some(({ externalAction, actionDetails }) =>
      externalAction === 'configure-project-schema' && actionDetails.deferred));
  } finally { cleanup(root); }
});

test('zero Project menu offers concrete manual and cancel recovery without mutation', async () => {
  const root = fixture();
  const gh = githubFixture();
  try {
    for (const language of ['de', 'en']) {
      for (const selectedIndex of [1, 2]) {
        await assert.rejects(() => completeInteractiveOptions({
          ...structuredClone(base),
          language,
          projectTitle: null,
          createProject: false,
          createProjectApproved: false,
        }, null, async (_label, fallback) => fallback, async (_label, choices) => {
          assert.equal(choices.length, 3);
          assert.match(choices[1], /manuell|manually/iu);
          return choices[selectedIndex];
        }, gh), (error) => {
          const message = String(error.message);
          assert.match(message, /frickeldave-test/u);
          assert.match(message, /squad-heroes-snake/u);
          assert.match(message, /gh project create --owner frickeldave-test --title squad-heroes-snake/u);
          assert.match(message, /gh project list --owner frickeldave-test --limit 100 --format json/u);
          assert.match(message, /--project-number <number>/u);
          assert.match(message, /HEROES_PROJECT_TOKEN/u);
          assert.match(message, /--dry-run/u);
          return true;
        });
      }
    }
    assert.equal(gh.calls.filter(({ args }) => args.join(' ').includes('createProjectV2')).length, 0);
    assert.equal(existsSync(path.join(root, '.squad/heroes.json')), false);
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
    assert.equal('secret' in config.extensions['board-sync'], false);
    assert.equal(config.recovery.planVersion, 1);
    assert.equal(plan.projectState, 'APPLY_CREATE');
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
    assert.throws(() => buildInstallPlan(denied, structuredClone(base), deniedGh), (error) => {
      assert.match(error.message, /403|creation.*denied/iu);
      assert.match(error.message, /gh project create --owner frickeldave-test --title squad-heroes-snake/u);
      assert.doesNotMatch(error.message, /ghp_|token=/u);
      return true;
    });
    assert.equal(deniedGh.calls.filter(({ args }) => args.join(' ').includes('createProjectV2')).length, 0);
  } finally { cleanup(denied); }
  const partial = fixture();
  const partialGh = githubFixture({ failAfterCreate: true });
  try {
    const plan = buildInstallPlan(partial, structuredClone(base), partialGh);
    assert.throws(() => applyPlan(partial, plan, {}, partialGh), (error) => {
      assert.match(error.message, /partially|schema|field|recover/iu);
      assert.match(error.message, /gh project list --owner frickeldave-test --limit 100 --format json/u);
      assert.doesNotMatch(error.message, /gh project create --owner/u);
      assert.match(error.message, /No local Companion state was written/u);
      assert.doesNotMatch(error.message, /ghp_|token=/u);
      return true;
    });
    assert.equal(partialGh.calls.filter(({ args }) => args.join(' ').includes('createProjectV2')).length, 1);
    assert.equal(existsSync(path.join(partial, '.squad/heroes.json')), false);
  } finally { cleanup(partial); }
  const failedCreate = fixture();
  const failedCreateGh = githubFixture({ failCreate: true });
  try {
    const plan = buildInstallPlan(failedCreate, structuredClone(base), failedCreateGh);
    assert.throws(() => applyPlan(failedCreate, plan, {}, failedCreateGh), (error) => {
      assert.match(error.message, /Project may nevertheless already exist/u);
      assert.match(error.message, /gh project list --owner frickeldave-test --limit 100 --format json/u);
      assert.match(error.message, /gh project create --owner frickeldave-test --title squad-heroes-snake/u);
      assert.doesNotMatch(error.message, /creation failed|ghp_|token=/u);
      return true;
    });
    assert.equal(existsSync(path.join(failedCreate, '.squad/heroes.json')), false);
  } finally { cleanup(failedCreate); }
  const lookup = fixture();
  const lookupGh = githubFixture({ missingAfterCreate: true });
  try {
    const plan = buildInstallPlan(lookup, structuredClone(base), lookupGh);
    assert.throws(() => applyPlan(lookup, plan, {}, lookupGh), /404|not visible|owner\/admin/iu);
    assert.equal(lookupGh.calls.filter(({ args }) => args.join(' ').includes('createProjectV2')).length, 1);
    assert.equal(existsSync(path.join(lookup, '.squad/heroes.json')), false);
  } finally { cleanup(lookup); }
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
