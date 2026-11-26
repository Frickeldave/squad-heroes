import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHeroesConfig, validateDeploymentBranches, validateHeroesConfig } from '../src/config.mjs';

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
  assert.equal(config.profile, 'typescript-development');
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

test('accepts exactly one to three distinct branch refs without normalization', () => {
  assert.deepEqual(validateDeploymentBranches(['dev']), ['dev']);
  assert.deepEqual(validateDeploymentBranches(['dev', 'int', 'prd']), ['dev', 'int', 'prd']);
  assert.throws(() => validateDeploymentBranches([]), /one, two or three/);
  assert.throws(() => validateDeploymentBranches(['dev', 'DEV']), /unique/);
  assert.throws(() => validateDeploymentBranches(['bad..branch']), /Invalid/);
});
