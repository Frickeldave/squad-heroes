import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { assertGithubWriteAccess, assertSquadCompatibility, detectSquadVersion } from '../src/preflight.mjs';
import { cleanup, fixture, write } from './helpers.mjs';

test('accepts exactly one Squad 2.0.0 marker', () => {
  const root = fixture();
  try {
    assert.equal(assertSquadCompatibility(root), '2.0.0');
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
  ['newer', '<!-- version: 2.0.1 -->', '2.0.1'],
  ['prerelease', '<!-- version: 2.0.0-rc.1 -->', 'invalid'],
  ['build', '<!-- version: 2.0.0+build -->', 'invalid'],
  ['range', '<!-- version: ^2.0.0 -->', 'invalid'],
  ['latest', '<!-- version: latest -->', 'invalid'],
]) {
  test(`rejects ${label} version without mutation`, () => {
    const root = fixture('invalid-placeholder');
    write(root, '.github/agents/squad.agent.md', source);
    const before = readdirSync(root).sort();
    try {
      assert.equal(detectSquadVersion(root), detected);
      assert.throws(() => assertSquadCompatibility(root), (error) =>
        error.message === `ERROR: squad-heroes requires Squad 2.0.0 exactly; detected "${detected}". Installation aborted before mutation.` &&
        error.details.exitCode === 2
      );
      assert.deepEqual(readdirSync(root).sort(), before);
      assert.equal(readFileSync(path.join(root, '.github/agents/squad.agent.md'), 'utf8'), source);
    } finally {
      cleanup(root);
    }
  });
}
