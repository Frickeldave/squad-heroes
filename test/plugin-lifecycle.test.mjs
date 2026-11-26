import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { cleanup, fixture, write } from './helpers.mjs';

const product = path.resolve(import.meta.dirname, '..');
const squad = spawnSync('squad', ['--version'], { encoding: 'utf8' });

function run(root, args) {
  return spawnSync('squad', ['plugin', ...args], { cwd: root, encoding: 'utf8' });
}

function mustRun(root, args) {
  const result = run(root, args);
  assert.equal(result.status, 0, `${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`);
  return result;
}

function state(root, name) {
  return JSON.parse(readFileSync(path.join(root, '.squad/plugins', name), 'utf8'));
}

function newerProduct(version) {
  const source = product;
  const destination = path.join(path.resolve(import.meta.dirname, '.workspaces'), `product-${process.pid}-${version}`);
  const manifest = JSON.parse(readFileSync(path.join(source, 'plugin.manifest.json'), 'utf8'));
  write(destination, 'plugin.manifest.json', `${JSON.stringify({ ...manifest, version }, null, 2)}\n`);
  for (const file of manifest.files) {
    const sourceFile = readFileSync(path.join(source, file.source));
    const content = file.source.endsWith('/agents/tony.en.md')
      ? `${sourceFile.toString('utf8')}\n<!-- fixture update ${version} -->\n`
      : sourceFile;
    write(destination, file.source, content);
  }
  return destination;
}

function sha(value) {
  return createHash('sha256').update(value).digest('hex');
}

for (const fixtureId of [1, 2]) test(`real Squad lifecycle works in neutral TypeScript fixture ${fixtureId}`, {
  skip: squad.status !== 0 ? 'Squad CLI is not installed in this environment' : false,
}, () => {
  const root = fixture();
  const productV2 = newerProduct(`0.2.${fixtureId}`);
  const companion = {
    charter: '# locally materialized companion charter\n',
    prompt: '# local active prompt\n',
    metadata: '{"schemaVersion":1}\n',
  };
  write(root, '.squad/agents/tony/charter.md', companion.charter);
  write(root, '.github/prompts/startwork.prompt.md', companion.prompt);
  write(root, '.squad/heroes.json', companion.metadata);
  try {
    mustRun(root, ['validate', product]);
    mustRun(root, ['dry-run', product]);
    mustRun(root, ['install', product]);
    mustRun(root, ['enable', 'squad-heroes']);
    mustRun(root, ['list', '--json']);
    mustRun(root, ['verify']);

    const firstTarget = path.join(root, '.squad/templates/squad-heroes/agents/tony.en.md');
    const firstBytes = readFileSync(firstTarget);
    const firstLock = state(root, 'lock.json').plugins['squad-heroes'];
    const firstManifestHash = firstLock.manifest_sha256;
    const installedBefore = state(root, 'installed.json').plugins.filter(({ id }) => id === 'squad-heroes');
    assert.equal(installedBefore.length, 1);
    assert.equal(installedBefore[0].version, '0.1.0');

    mustRun(root, ['install', product]);
    mustRun(root, ['verify']);
    assert.deepEqual(readFileSync(firstTarget), firstBytes, 'same-content install must not change plugin targets');
    assert.equal(state(root, 'installed.json').plugins.filter(({ id }) => id === 'squad-heroes').length, 1);
    assert.equal(state(root, 'lock.json').plugins['squad-heroes'].manifest_sha256, firstManifestHash);

    mustRun(root, ['verify']);
    mustRun(root, ['install', productV2]);
    const updated = mustRun(root, ['list', '--json']);
    assert.match(updated.stdout, new RegExp(`"version": "${`0.2.${fixtureId}`}"`
      .replaceAll('.', '\\.')));
    const updatedPlugin = state(root, 'installed.json').plugins.find(({ id }) => id === 'squad-heroes');
    const updatedLock = state(root, 'lock.json').plugins['squad-heroes'];
    assert.equal(updatedPlugin.version, `0.2.${fixtureId}`);
    assert.notEqual(updatedLock.manifest_sha256, firstManifestHash);
    assert.equal(updatedLock.files.find(({ target }) => target.includes('tony.en.md')).sha256,
      sha(readFileSync(path.join(productV2, '.squad/heroes/agents/tony.en.md'))));
    assert.match(readFileSync(firstTarget, 'utf8'), new RegExp(`fixture update ${`0.2.${fixtureId}`}`));

    const changedPluginTarget = readFileSync(firstTarget, 'utf8') + '\n# local conflict\n';
    write(root, '.squad/templates/squad-heroes/agents/tony.en.md', changedPluginTarget);
    const conflict = run(root, ['verify']);
    assert.notEqual(conflict.status, 0);
    assert.match(`${conflict.stdout}\n${conflict.stderr}`, /checksum mismatch/);
    assert.equal(readFileSync(firstTarget, 'utf8'), changedPluginTarget,
      'a failed verify must leave the conflict untouched; update must not proceed');

    const invalidManifest = JSON.parse(readFileSync(path.join(productV2, 'plugin.manifest.json'), 'utf8'));
    invalidManifest.files[0].target = '../../outside.mjs';
    const failedSource = path.join(root, '.failed-plugin-source');
    for (const file of invalidManifest.files) {
      write(failedSource, file.source, readFileSync(path.join(productV2, file.source)));
    }
    write(failedSource, 'plugin.manifest.json', `${JSON.stringify(invalidManifest, null, 2)}\n`);
    const beforeFailedLock = readFileSync(path.join(root, '.squad/plugins/lock.json'), 'utf8');
    const failure = run(root, ['install', failedSource]);
    assert.notEqual(failure.status, 0);
    assert.equal(readFileSync(path.join(root, '.squad/plugins/lock.json'), 'utf8'), beforeFailedLock);
    assert.equal(existsSync(path.join(root, 'outside.mjs')), false);

    mustRun(root, ['disable', 'squad-heroes']);
    mustRun(root, ['uninstall', 'squad-heroes']);
    assert.equal(existsSync(firstTarget), false);
    assert.equal(readFileSync(path.join(root, '.squad/agents/tony/charter.md'), 'utf8'), companion.charter);
    assert.equal(readFileSync(path.join(root, '.github/prompts/startwork.prompt.md'), 'utf8'), companion.prompt);
    assert.equal(readFileSync(path.join(root, '.squad/heroes.json'), 'utf8'), companion.metadata);
    assert.equal(state(root, 'installed.json').plugins.some(({ id }) => id === 'squad-heroes'), false);
  } finally {
    cleanup(root);
    cleanup(productV2);
  }
});

test('the real CLI has install-based update semantics and no proprietary setup command', () => {
  assert.equal(existsSync(path.join(product, 'scripts/plugin-setup.mjs')), false);
  const packageJson = JSON.parse(readFileSync(path.join(product, 'package.json'), 'utf8'));
  assert.equal(packageJson.scripts['plugin-setup'], undefined);
  assert.match(readFileSync(path.join(product, 'README.md'), 'utf8'), /squad plugin install <local-dir>/);
});
