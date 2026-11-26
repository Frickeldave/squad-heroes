import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { assertGithubWriteAccess, assertSquadCompatibility, detectSquadVersion } from '../src/preflight.mjs';
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

test('GitHub auth gate exposes no credentials and stops on host or permission failure', () => {
  const calls = [];
  assert.throws(() => assertGithubWriteAccess('owner/repository', {
    spawn: (command, args) => {
      calls.push({ command, args });
      return { status: 1, stdout: '', stderr: '' };
    },
  }), /gh auth login/);
  assert.deepEqual(calls, [{ command: 'gh', args: ['auth', 'status'] }]);

  assert.throws(() => assertGithubWriteAccess('owner/repository', {
    spawn: (_command, args) => args[0] === 'auth'
      ? { status: 0, stdout: '', stderr: '' }
      : { status: 0, stdout: 'false\n', stderr: '' },
  }), /push permission/);
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
