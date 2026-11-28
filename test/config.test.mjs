import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHeroesConfig,
  migrateHeroesConfig,
  validateDeploymentBranches,
  validateHeroesConfig,
} from '../src/config.mjs';

const valid = () => buildHeroesConfig({
  repository: 'owner/repository',
  language: 'en',
  modelDefaults: { reqeng: 'mai-code-2', work: 'claude-sonnet-5.5', review: 'claude-opus-5.5' },
  branches: ['main'],
});

test('creates the minimal closed v1 companion config', () => {
  const config = valid();
  assert.deepEqual(config.modelDefaults, {
    reqeng: 'mai-code-2',
    work: 'claude-sonnet-5.5',
    review: 'claude-opus-5.5',
  });
  assert.equal(config.profile, '001');
});

test('rejects unknown state and model keys', () => {
  assert.throws(() => validateHeroesConfig({ ...valid(), arbitrary: true }), /Unknown/);
  assert.throws(() => validateHeroesConfig({
    ...valid(),
    modelDefaults: { reqeng: 'a', work: 'b', review: 'c', extra: 'd' },
  }), /exactly/);
});

test('rejects profile changes and auto model fallback', () => {
  assert.throws(() => validateHeroesConfig({ ...valid(), profile: 'other' }), /immutable|cannot be changed|profile must/);
  assert.throws(() => validateHeroesConfig({
    ...valid(),
    modelDefaults: { ...valid().modelDefaults, work: 'auto' },
  }), /explicit model/);
});

test('migrates the legacy TypeScript profile once to profile 001', () => {
  const legacy = { ...valid(), profile: 'typescript-development' };
  const migrated = migrateHeroesConfig(legacy);
  assert.equal(legacy.profile, 'typescript-development');
  assert.equal(migrated.profile, '001');
  assert.equal(migrateHeroesConfig(migrated).profile, '001');
  assert.equal(validateHeroesConfig(migrated).profile, '001');
});

test('accepts exactly one to three distinct branch refs without normalization', () => {
  assert.deepEqual(validateDeploymentBranches(['dev']), ['dev']);
  assert.deepEqual(validateDeploymentBranches(['dev', 'int', 'prd']), ['dev', 'int', 'prd']);
  assert.throws(() => validateDeploymentBranches([]), /one, two or three/);
  assert.throws(() => validateDeploymentBranches(['dev', 'DEV']), /unique/);
  assert.throws(() => validateDeploymentBranches(['bad..branch']), /Invalid/);
});

test('existing v1 board state remains valid after Project number resolution', () => {
  const config = buildHeroesConfig({
    repository: 'frickeldave-test/squad-heroes-snake',
    language: 'en',
    modelDefaults: { reqeng: 'a', work: 'b', review: 'c' },
    branches: ['main'],
    boardSync: true,
    board: {
      owner: 'frickeldave-test',
      number: 42,
      statusField: 'Status',
      statusMap: { 'go:yes': 'Ready' },
    },
  });
  assert.equal(validateHeroesConfig(config).extensions['board-sync'].number, 42);
  assert.throws(() => validateHeroesConfig({
    ...config,
    extensions: {
      'board-sync': { ...config.extensions['board-sync'], number: '{{PROJECT_NUMBER}}' },
    },
  }), /incomplete/u);
});
