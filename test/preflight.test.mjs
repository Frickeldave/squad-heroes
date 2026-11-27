import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import {
  assertGithubAuthentication,
  assertProjectWriteAccess,
  assertGithubWriteAccess,
  assertSquadCompatibility,
  detectSquadVersion,
  listBoardProjects,
  preflightGithubAccess,
} from '../src/preflight.mjs';
import { cleanup, fixture, write } from './helpers.mjs';

for (const version of ['2.0.0', '2.0.1', '3.0.0', '3.0.0+build.7']) {
  test(`accepts supported stable Squad ${version} marker`, () => {
    const root = fixture(version);
    try {
      assert.equal(assertSquadCompatibility(root), version);
    } finally {
      cleanup(root);
    }
  });
}

test('0.13.1 plugin preflight exits 2 with safe update guidance', () => {
  const root = fixture('0.13.1');
  try {
    const result = spawnSync(process.execPath, [
      path.resolve(import.meta.dirname, '../scripts/plugin-preflight.mjs'),
      '--target',
      root,
    ], { encoding: 'utf8' });
    const output = `${result.stdout}\n${result.stderr}`;
    assert.equal(result.status, 2);
    assert.match(output, /minimum Squad version 2\.0\.0 is required; detected "0\.13\.1"/u);
    assert.match(output, /squad upgrade --self/u);
    assert.match(output, /sudo sh -c 'umask 022/u);
    assert.match(output, /--allow-scripts=@bradygaster\/squad-cli,node-pty,koffi,protobufjs/u);
    assert.match(output, /not by running Squad itself under sudo/u);
    assert.match(output, /command -v squad/u);
    assert.match(output, /squad upgrade/u);
    assert.doesNotMatch(output, /ghp_|github_pat_|Authorization\s*:\s*Bearer/iu);
  } finally {
    cleanup(root);
  }
});

function ghFixture(repositoryResult, overrides = {}) {
  const calls = [];
  const spawn = (command, args) => {
    calls.push({ command, args });
    if (args[0] === 'auth') return overrides.auth ?? {
      status: 0,
      stdout: '',
      stderr: "- Token scopes: 'repo', 'project'\n",
    };
    if (args[0] === 'api' && args[1] === 'user') {
      return overrides.account ?? { status: 0, stdout: 'octocat\n', stderr: '' };
    }
    if (args[0] === 'api' && args[1] === `repos/${overrides.repository ?? 'owner/repository'}`) {
      return typeof repositoryResult === 'function' ? repositoryResult(args) : repositoryResult;
    }
    return overrides.fallback ?? { status: 0, stdout: '', stderr: '' };
  };
  return { spawn, calls };
}

test('GitHub preflight safely reports every failure category', () => {
  const secret = 'ghp_SUPER_SECRET_VALUE';
  const cases = [
    {
      category: 'cli_missing',
      fixture: ghFixture(null, { auth: { error: { code: 'ENOENT' }, status: null } }),
      pattern: /GitHub CLI is unavailable|`gh` is missing/u,
      command: 'gh auth login --hostname github.com --web',
    },
    {
      category: 'auth_failed',
      fixture: ghFixture(null, { auth: { status: 1, stderr: `Authorization: Bearer ${secret}` } }),
      pattern: /GitHub authentication failed/u,
      command: 'gh auth status --hostname github.com',
    },
    {
      category: 'repository_not_found',
      fixture: ghFixture({ status: 1, stdout: secret, stderr: 'HTTP 404: Not Found token=hidden' }),
      pattern: /gh repo view owner\/repository/u,
      command: 'gh api repos/owner/repository --jq .permissions',
    },
    {
      category: 'repository_read_denied',
      fixture: ghFixture({ status: 0, stdout: '{"pull":false,"push":false,"admin":false,"triage":false}' }),
      pattern: /read access/u,
      command: 'gh repo view owner/repository',
    },
    {
      category: 'repository_push_denied',
      fixture: ghFixture({ status: 0, stdout: '{"pull":true,"push":false,"admin":false,"triage":false}' }),
      pattern: /write or collaborator access/u,
      command: 'gh api user --jq .login',
    },
  ];
  for (const item of cases) {
    assert.throws(
      () => assertGithubWriteAccess('owner/repository', { spawn: item.fixture.spawn }),
      (error) => {
        assert.equal(error.details.category, item.category);
        assert.match(error.message, item.pattern);
        assert.match(error.message, new RegExp(item.command.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
        assert.doesNotMatch(error.message, /SUPER_SECRET|ghp_|github_pat_|Authorization|token=/iu);
        assert.match(error.message, /github\.com/u);
        assert.match(error.message, /No mutation started/u);
        return true;
      }
    );
  }
});

test('GitHub preflight diagnoses account mismatch and API errors without leaking output', () => {
  const mismatch = ghFixture({ status: 0, stdout: '{"pull":true,"push":true}' });
  assert.throws(() => assertGithubWriteAccess('owner/repository', {
    spawn: mismatch.spawn,
    expectedAccount: 'hubot',
  }), (error) => {
    assert.equal(error.details.category, 'account_mismatch');
    assert.match(error.message, /Active gh account: octocat/u);
    assert.match(error.message, /gh auth switch --hostname github.com --user hubot/u);
    assert.match(error.message, /owner equality is not required/u);
    return true;
  });
  assert.throws(() => assertGithubWriteAccess('owner/repository', {
    spawn: mismatch.spawn,
    expectedAccount: 'ghp_EXPECTED_SECRET',
  }), (error) => {
    assert.equal(error.details.category, 'account_mismatch');
    assert.match(error.message, /safe public login/u);
    assert.doesNotMatch(error.message, /ghp_EXPECTED_SECRET/u);
    return true;
  });

  const api = ghFixture({ status: 1, stdout: 'github_pat_private', stderr: 'dial tcp: lookup github.com: no such host ghp_private' });
  assert.throws(() => assertGithubWriteAccess('owner/repository', { spawn: api.spawn }), (error) => {
    assert.equal(error.details.category, 'api_error');
    assert.match(error.message, /exit status 1/u);
    assert.match(error.message, /VPN, DNS/u);
    assert.match(error.message, /Active gh account: octocat/u);
    assert.doesNotMatch(error.message, /private|ghp_/iu);
    return true;
  });
});

test('GitHub preflight uses one permissions check and returns booleans only', () => {
  const fixture = ghFixture({ status: 0, stdout: JSON.stringify({
    admin: false,
    maintain: true,
    push: true,
    triage: true,
    pull: true,
  }) });
  const result = assertGithubWriteAccess('owner/repository', { spawn: fixture.spawn });
  assert.deepEqual(result, {
    repository: 'owner/repository',
    owner: 'owner',
    account: 'octocat',
    host: 'github.com',
    read: true,
    push: true,
    admin: false,
    triage: true,
  });
  const permissionCalls = fixture.calls.filter(({ args }) => args[0] === 'api' && args[1].startsWith('repos/'));
  assert.deepEqual(permissionCalls, [{
    command: 'gh',
    args: ['api', 'repos/owner/repository', '--jq', '.permissions'],
  }]);
});

test('GitHub Project preflight requires the exact project scope after repository access', () => {
  const readOnly = ghFixture(
    { status: 0, stdout: '{"pull":true,"push":true}' },
    { auth: {
      status: 0,
      stdout: "- Token scopes: 'repo', 'read:project'\n",
      stderr: "Token: ghp_SUPER_SECRET\n",
    } }
  );
  assert.throws(() => preflightGithubAccess('owner/repository', {
    spawn: readOnly.spawn,
  }), (error) => {
    assert.equal(error.details.category, 'project_scope');
    assert.equal(error.details.activeAccount, 'octocat');
    assert.match(error.message, /read:project granted/u);
    assert.match(error.message, /gh auth refresh -h github.com -s project/u);
    assert.match(error.message, /gh auth status --hostname github.com/u);
    assert.doesNotMatch(error.message, /ghp_|Token:/u);
    return true;
  });
  assert.equal(readOnly.calls.some(({ args }) =>
    args[0] === 'project' && args[1] === 'list'
  ), false);

  const granted = ghFixture(
    { status: 0, stdout: '{"pull":true,"push":true}' },
    { auth: {
      status: 0,
      stdout: "Logged in to github.com account octocat\n- Token scopes: 'repo', 'project'\n",
      stderr: "Token: ghp_NEVER_PRINT\n",
    }, fallback: { status: 0, stdout: '{"projects":[]}\n', stderr: '' } }
  );
  const access = preflightGithubAccess('owner/repository', { spawn: granted.spawn });
  assert.equal(access.account, 'octocat');
  assert.equal(access.projectScope, true);
  assert.equal(access.scopeStatus, 'project granted');
  const authentication = assertGithubAuthentication({ spawn: granted.spawn });
  assert.deepEqual(authentication.scopes, ['repo', 'project']);
  assert.doesNotMatch(JSON.stringify(authentication), /ghp_|NEVER_PRINT|Token/u);
});

test('GitHub Project scope and access failures are actionable and localized', () => {
  const scope = { status: 1, stdout: '', stderr: 'requires scope project; token=secret' };
  assert.throws(() => listBoardProjects('owner/repository', {
    account: 'octocat',
    spawn: () => scope,
  }), (error) => {
    assert.equal(error.details.category, 'project_scope');
    assert.match(error.message, /gh auth refresh -h github.com -s project/u);
    assert.match(error.message, /gh auth status --hostname github.com/u);
    assert.match(error.message, /Active gh account: octocat/u);
    assert.doesNotMatch(error.message, /token=secret/u);
    return true;
  });

  const projectAuthentication = {
    account: 'frickeldave-test',
    projectScope: true,
    scopes: ['project'],
    scopeStatus: 'project granted',
  };

  test('Project write verification accepts only matching partial GraphQL NOT_FOUND data', () => {
    const cases = [
      {
        ownerType: 'User',
        branch: 'user',
        opposite: 'organization',
        oppositeName: 'Organization',
      },
      {
        ownerType: 'Organization',
        branch: 'organization',
        opposite: 'user',
        oppositeName: 'User',
      },
    ];
    for (const item of cases) {
      const payload = {
        data: {
          [item.opposite]: null,
          [item.branch]: { projectV2: {
            id: 'PVT_fixture',
            number: 3,
            viewerCanUpdate: true,
          } },
        },
        errors: [{
          type: 'NOT_FOUND',
          path: [item.opposite],
          message: `Could not resolve to a ${item.oppositeName} with the login of 'frickeldave-test'.`,
        }],
      };
      const result = assertProjectWriteAccess('frickeldave-test/repository', {
        number: 3,
        ownerType: item.ownerType,
      }, {
        authentication: projectAuthentication,
        projectCatalog: [{ number: 3, owner: { type: item.ownerType } }],
        spawn: () => ({
          status: 1,
          stdout: JSON.stringify(payload),
          stderr: `gh: ${payload.errors[0].message}\n`,
        }),
      });
      assert.equal(result.id, 'PVT_fixture');
      assert.equal(result.number, 3);
      assert.equal(result.ownerType, item.ownerType);
      assert.equal(result.viewerCanUpdate, true);
    }
  });

  test('Project write verification rejects partial status without a valid writable node', () => {
    const deniedPayloads = [
      {
        status: 1,
        stdout: JSON.stringify({
          data: { user: { projectV2: null } },
          errors: [{
            type: 'NOT_FOUND',
            path: ['organization'],
            message: "Could not resolve to an Organization with the login of 'frickeldave-test'.",
          }],
        }),
        stderr: "gh: Could not resolve to an Organization with the login of 'frickeldave-test'.",
      },
      {
        status: 1,
        stdout: JSON.stringify({
          data: { user: { projectV2: {
            id: 'PVT_fixture', number: 3, viewerCanUpdate: true,
          } } },
          errors: [{ type: 'UNAUTHORIZED', path: ['user'], message: 'Bad credentials' }],
        }),
        stderr: 'Bad credentials',
      },
      {
        status: 1,
        stdout: JSON.stringify({
          data: { user: { projectV2: {
            id: 'PVT_fixture', number: 3, viewerCanUpdate: true,
          } } },
          errors: [{ type: 'RATE_LIMITED', message: 'API rate limit exceeded' }],
        }),
        stderr: 'API rate limit exceeded',
      },
    ];
    for (const denied of deniedPayloads) {
      assert.throws(() => assertProjectWriteAccess('frickeldave-test/repository', {
        number: 3,
        ownerType: 'User',
      }, {
        authentication: projectAuthentication,
        projectCatalog: [{ number: 3, owner: { type: 'User' } }],
        spawn: () => denied,
      }), /Project access failed|Project write access|non-owner error/iu);
    }
  });
  assert.throws(() => listBoardProjects('owner/repository', {
    account: 'octocat',
    language: 'de',
    spawn: () => ({ status: 1, stdout: '', stderr: 'HTTP 500 internal ghp_secret' }),
  }), (error) => {
    assert.equal(error.details.category, 'project_access');
    assert.match(error.message, /Keine Mutation gestartet/u);
    assert.match(error.message, /VPN\/DNS/u);
    assert.doesNotMatch(error.message, /ghp_secret/u);
    return true;
  });
});

for (const [label, source, detected] of [
  ['missing', '# Squad\n', 'missing'],
  ['multiple', '<!-- version: 2.0.0 --><!-- version: 2.0.0 -->', 'multiple'],
  ['invalid', '<!-- version: nope -->', 'invalid'],
  ['older', '<!-- version: 1.9.0 -->', '1.9.0'],
  ['prerelease', '<!-- version: 2.0.0-rc.1 -->', 'invalid'],
  ['range', '<!-- version: ^2.0.0 -->', 'invalid'],
  ['latest', '<!-- version: latest -->', 'invalid'],
  ['legacy', '<!-- version: 0.13.1 -->', '0.13.1'],
]) {
  test(`rejects ${label} version without mutation`, () => {
    const root = fixture('invalid-placeholder');
    write(root, '.github/agents/squad.agent.md', source);
    const before = readdirSync(root).sort();
    try {
      assert.equal(detectSquadVersion(root), detected);
      assert.throws(() => assertSquadCompatibility(root), (error) =>
        error.message.includes(`ERROR: squad-heroes minimum Squad version 2.0.0 is required; detected "${detected}".`) &&
        error.message.includes('`squad upgrade --self`') &&
        error.message.includes('--allow-scripts=@bradygaster/squad-cli,node-pty,koffi,protobufjs') &&
        error.message.includes('not by running Squad itself under sudo') &&
        error.details.exitCode === 2
      );
      assert.deepEqual(readdirSync(root).sort(), before);
      assert.equal(readFileSync(path.join(root, '.github/agents/squad.agent.md'), 'utf8'), source);
    } finally {
      cleanup(root);
    }
  });
}
