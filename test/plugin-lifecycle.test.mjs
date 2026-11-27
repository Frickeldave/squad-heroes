import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { cleanup, fixture, write } from './helpers.mjs';

const product = path.resolve(import.meta.dirname, '..');
const squad = spawnSync('squad', ['--version'], { encoding: 'utf8' });
const companionArgs = [
  '--target', '.',
  '--repository', 'owner/repository',
  '--profile', 'typescript-development',
  '--deployment-branches', '1',
  '--deployment-branch-1', 'main',
  '--language', 'en',
  '--model-reqeng', 'mai-code-2',
  '--model-work', 'claude-sonnet-5.5',
  '--model-review', 'gpt-6.1-terra',
];

function run(root, args) {
  return spawnSync('squad', ['plugin', ...args], { cwd: root, encoding: 'utf8' });
}

function mustRun(root, args) {
  const result = run(root, args);
  assert.equal(result.status, 0, `${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`);
  return result;
}

function runCompanion(root, extra = []) {
  const installed = path.join(root, '.squad/templates/squad-heroes/companion/scripts/install');
  return spawnSync(process.execPath, [installed, ...companionArgs, ...extra], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${path.join(root, 'bin')}:${process.env.PATH}` },
  });
}

function mustRunCompanion(root, extra = []) {
  const result = runCompanion(root, extra);
  assert.equal(result.status, 0, `installed Companion failed:\n${result.stdout}\n${result.stderr}`);
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
    const content = file.target.endsWith('/agents/tony.en.md')
      ? sourceFile.toString('utf8').replace(
        '<!-- squad-heroes:charter:tony:end -->',
        `\n<!-- fixture update ${version} -->\n<!-- squad-heroes:charter:tony:end -->`
      )
      : sourceFile;
    write(destination, file.source, content);
  }
  const internalManifest = JSON.parse(readFileSync(
    path.join(destination, 'dist/companion/.squad/heroes/manifest.json'),
    'utf8'
  ));
  internalManifest.version = version;
  const charter = internalManifest.files.find(({ target }) =>
    target === '.squad/heroes/agents/tony.en.md');
  charter.sha256 = sha(readFileSync(
    path.join(destination, 'dist/companion/.squad/heroes/agents/tony.en.md')
  ));
  write(
    destination,
    'dist/companion/.squad/heroes/manifest.json',
    `${JSON.stringify(internalManifest, null, 2)}\n`
  );
  return destination;
}

function sha(value) {
  return createHash('sha256').update(value).digest('hex');
}

for (const fixtureId of [1, 2]) test(`real Squad lifecycle uses an installed self-contained Companion ${fixtureId}`, {
  skip: squad.status !== 0 ? 'Squad CLI is not installed in this environment' : false,
}, () => {
  const root = fixture();
  const productV2 = newerProduct(`0.2.${fixtureId}`);
  const activeScript = path.join(root, 'scripts/start-work.mjs');
  const activeWorkflow = path.join(root, '.github/workflows/heroes-ci.yml');
  const installedEntry = path.join(root, '.squad/templates/squad-heroes/companion/scripts/install');
  const installedCharter = path.join(root, '.squad/templates/squad-heroes/companion/.squad/heroes/agents/tony.en.md');
  write(root, 'bin/gh', `#!/bin/sh
if [ "$1" = "auth" ] && [ "$2" = "status" ]; then printf '%s\\n' "- Token scopes: 'repo', 'project'"; fi
if [ "$1" = "api" ] && [ "$2" = "user" ]; then printf 'octocat\\n'; fi
if [ "$1" = "api" ] && printf '%s' "$2" | grep -q '^repos/'; then printf '{"pull":true,"push":true,"admin":false,"triage":false}\\n'; fi
if [ "$1" = "project" ] && [ "$2" = "list" ]; then printf '{"projects":[]}\\n'; fi
exit 0
`);
  chmodSync(path.join(root, 'bin/gh'), 0o755);
  try {
    mustRun(root, ['validate', product]);
    const pluginDryRun = mustRun(root, ['dry-run', product]);
    assert.match(pluginDryRun.stdout, /templates\/squad-heroes\/companion\/scripts\/install/u);
    assert.match(pluginDryRun.stdout, /templates\/squad-heroes\/companion\/src\/installer/u);
    assert.match(pluginDryRun.stdout, /templates\/squad-heroes\/companion\/\.squad\/heroes\/companion\/scripts\/start-work/u);
    assert.match(pluginDryRun.stdout, /templates\/squad-heroes\/companion\/\.squad\/heroes\/companion\/workflows\/heroes-ci\.yml/u);
    assert.match(pluginDryRun.stdout, /templates\/squad-heroes\/companion\/\.squad\/heroes\/skills\/humanizer\/en-US\.md/u);
    assert.doesNotMatch(pluginDryRun.stdout, /(?:^|\n)\s*(?:scripts\/|\.github\/prompts\/|\.github\/workflows\/)/u);

    mustRun(root, ['install', product]);
    assert.equal(existsSync(installedEntry), true);
    const installedInstaller = readFileSync(installedEntry, 'utf8');
    assert.match(installedInstaller, /selectWithArrowKeys/u);
    assert.match(installedInstaller, /picker_help/u);
    assert.match(installedInstaller, /default_model_\$\{flow\}/u);
    assert.doesNotMatch(installedInstaller, /ask\(`Model for/u);
    assert.match(
      readFileSync(path.join(root, '.squad/templates/squad-heroes/companion/resources/messages.de.json'), 'utf8'),
      /Standardmodell für reqeng/u
    );
    mustRun(root, ['enable', 'squad-heroes']);
    mustRun(root, ['verify']);

    const companionDryRun = mustRunCompanion(root, ['--dry-run']);
    assert.match(companionDryRun.stdout, /scripts\/start-work\.mjs/u);
    assert.match(companionDryRun.stdout, /\.github\/prompts\/startwork\.prompt\.md/u);
    assert.match(companionDryRun.stdout, /\.github\/workflows\/heroes-ci\.yml/u);
    assert.match(companionDryRun.stdout, /\.squad\/agents\/tony\/charter\.md/u);
    assert.equal(existsSync(activeScript), false);

    const applied = mustRunCompanion(root);
    assert.match(applied.stdout, /"changed":[1-9]\d*/u);
    assert.equal(existsSync(activeScript), true);
    assert.equal(existsSync(activeWorkflow), true);
    mustRun(root, ['verify']);
    const noOp = mustRunCompanion(root);
    assert.match(noOp.stdout, /"changed":0/u);

    const activeBeforeUpdate = readFileSync(path.join(root, '.squad/agents/tony/charter.en.md'), 'utf8');
    const firstLock = state(root, 'lock.json').plugins['squad-heroes'];
    mustRun(root, ['install', productV2]);
    mustRun(root, ['verify']);
    assert.equal(state(root, 'installed.json').plugins.find(({ id }) => id === 'squad-heroes').version, `0.2.${fixtureId}`);
    assert.notEqual(state(root, 'lock.json').plugins['squad-heroes'].manifest_sha256, firstLock.manifest_sha256);
    assert.equal(
      state(root, 'lock.json').plugins['squad-heroes'].files.find(({ target }) =>
        target.endsWith('/companion/.squad/heroes/agents/tony.en.md')).sha256,
      sha(readFileSync(path.join(productV2, 'dist/companion/.squad/heroes/agents/tony.en.md')))
    );
    assert.equal(
      readFileSync(path.join(root, '.squad/agents/tony/charter.en.md'), 'utf8'),
      activeBeforeUpdate,
      'plugin update must not mutate active Companion targets'
    );
    assert.match(readFileSync(installedCharter, 'utf8'), new RegExp(`fixture update 0\\.2\\.${fixtureId}`));
    mustRunCompanion(root);
    assert.match(readFileSync(path.join(root, '.squad/agents/tony/charter.en.md'), 'utf8'),
      new RegExp(`fixture update 0\\.2\\.${fixtureId}`));

    mustRun(root, ['disable', 'squad-heroes']);
    mustRun(root, ['uninstall', 'squad-heroes']);
    assert.equal(existsSync(installedEntry), false);
    assert.equal(existsSync(activeScript), true);
    assert.equal(existsSync(activeWorkflow), true);
    assert.equal(existsSync(path.join(root, '.squad/agents/tony/charter.en.md')), true);
    assert.equal(state(root, 'installed.json').plugins.some(({ id }) => id === 'squad-heroes'), false);

    mustRun(root, ['install', productV2]);
    mustRun(root, ['verify']);
  } finally {
    cleanup(root);
    cleanup(productV2);
  }
});

test('the README documents installed-copy Companion semantics', () => {
  const readme = readFileSync(path.join(product, 'README.md'), 'utf8');
  assert.match(readme, /squad plugin install <local-dir>/);
  assert.match(readme, /\.squad\/templates\/squad-heroes\/companion\/scripts\/install/u);
});
