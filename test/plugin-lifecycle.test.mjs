import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { cleanup, fixture, write } from './helpers.mjs';

const product = path.resolve(import.meta.dirname, '..');
const squad = spawnSync('squad', ['--version'], { encoding: 'utf8' });

function run(root, args) {
  return spawnSync('squad', ['plugin', ...args], { cwd: root, encoding: 'utf8' });
}

for (const fixtureId of [1, 2]) test(`real Squad lifecycle works in neutral TypeScript fixture ${fixtureId}`, {
  skip: squad.status !== 0 ? 'Squad CLI is not installed in this environment' : false,
}, () => {
  const root = fixture();
  write(root, 'scripts/consumer.mjs', 'console.log("preserved");\n');
  try {
    for (const args of [
      ['install', product],
      ['enable', 'squad-heroes'],
      ['list', '--json'],
      ['verify'],
      ['disable', 'squad-heroes'],
      ['uninstall', 'squad-heroes'],
    ]) {
      const result = run(root, args);
      assert.equal(result.status, 0, `${args.join(' ')}: ${result.stderr}`);
    }
    assert.equal(existsSync(path.join(root, 'scripts/consumer.mjs')), true);
    assert.equal(existsSync(path.join(root, '.squad/templates/squad-heroes/agents/tony.en.md')), false);
    assert.equal(existsSync(path.join(root, '.squad/agents/tony/charter.md')), false);
  } finally {
    cleanup(root);
  }
});
