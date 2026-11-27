import { fail } from './errors.mjs';
import { safeRelativePath } from './io.mjs';

export const PROFILE_ID = 'typescript-development';
export const PROFILE_NAME = 'TypeScript Development';
export const AGENTS = Object.freeze([
  ['tony', 'Lead Architekt', 'Lead Architect'],
  ['pepper', 'Requirement Engineer', 'Requirement Engineer'],
  ['bruce', 'Backend Engineer', 'Backend Engineer'],
  ['clint', 'Tester', 'Tester'],
  ['maria', 'Dokumentation', 'Documentation'],
  ['natasha', 'Frontend Engineer', 'Frontend Engineer'],
  ['nick', 'DevOps Specialist', 'DevOps Specialist'],
]);
export const FLOWS = Object.freeze(['reqeng', 'work', 'review']);
const ALLOWED_TOP_LEVEL = new Set([
  'schemaVersion', 'product', 'profile', 'deploymentBranches', 'language', 'modelDefaults',
  'repository', 'managed', 'recovery', 'extensions', 'reviewBaseline',
]);

export function validateHeroesConfig(config, { allowProjectPlaceholder = false } = {}) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) fail('config_type', 'heroes.json must be an object');
  for (const key of Object.keys(config)) {
    if (!ALLOWED_TOP_LEVEL.has(key)) fail('config_key', `Unknown heroes.json key: ${key}`);
  }
  if (config.schemaVersion !== 1) fail('config_version', 'Unsupported or missing heroes.json schemaVersion');
  if (config.product !== 'squad-heroes') fail('config_product', 'product must be "squad-heroes"');
  if (config.profile !== PROFILE_ID) fail('config_profile', `profile must be ${PROFILE_ID} and cannot be changed in place`);
  if (!['de', 'en'].includes(config.language)) fail('config_language', 'language must be de or en');
  const models = config.modelDefaults;
  if (!models || typeof models !== 'object' || Array.isArray(models) ||
      Object.keys(models).sort().join(',') !== FLOWS.slice().sort().join(',')) {
    fail('model_defaults', 'modelDefaults must contain exactly reqeng, work and review');
  }
  for (const flow of FLOWS) {
    if (typeof models[flow] !== 'string' || !models[flow].trim() || models[flow] === 'auto') {
      fail('model_default', `modelDefaults.${flow} must be a non-empty explicit model ID`);
    }
  }
  const branches = config.deploymentBranches;
  validateDeploymentBranches(branches);
  if (!/^[-A-Za-z0-9_.]+\/[-A-Za-z0-9_.]+$/u.test(config.repository ?? '')) {
    fail('repository', 'repository must use owner/name syntax');
  }
  if (!config.managed || config.managed !== 'squad-heroes') fail('managed', 'managed ownership marker is invalid');
  if (config.reviewBaseline !== undefined &&
      (typeof config.reviewBaseline !== 'string' || !/^[0-9a-f]{40,64}$/u.test(config.reviewBaseline))) {
    fail('review_baseline', 'reviewBaseline must be an immutable commit ID');
  }
  if (!config.recovery || typeof config.recovery.planVersion !== 'number') {
    fail('recovery', 'recovery.planVersion is required');
  }
  const recoveryKeys = Object.keys(config.recovery).sort().join(',');
  if (!['lastCompletedPlan,planVersion',
       'decisions,lastCompletedPlan,planVersion,targets',
       'lastCompletedPlan,planVersion,targets'].includes(recoveryKeys)) {
    fail('recovery', 'recovery contains unsupported keys');
  }
  for (const [target, checksum] of Object.entries(config.recovery.targets ?? {})) {
    if (!safeRelativePath(target) || !/^[0-9a-f]{64}$/u.test(checksum)) {
      fail('recovery', `invalid recovery baseline: ${target}`);
    }
  }
  for (const [name, extension] of Object.entries(config.extensions ?? {})) {
    if (extension?.schemaVersion !== 1 || name !== 'board-sync' || extension.enabled !== true) {
      fail('extension', `Unsupported extension: ${name}`);
    }
    const keys = Object.keys(extension).sort().join(',');
    if (keys !== 'enabled,number,owner,schemaVersion,statusField,statusMap') {
      fail('extension', 'board-sync extension must have the complete closed schema');
    }
    const statuses = Object.values(extension.statusMap ?? {});
    if (!/^[A-Za-z0-9_.-]+$/u.test(extension.owner ?? '') ||
        (!(
          Number.isInteger(extension.number) && extension.number > 0
        ) && !(allowProjectPlaceholder && extension.number === '{{PROJECT_NUMBER}}')) ||
        typeof extension.statusField !== 'string' || !extension.statusField.trim() ||
        !extension.statusMap || typeof extension.statusMap !== 'object' ||
        Array.isArray(extension.statusMap) || Object.keys(extension.statusMap).length === 0 ||
        statuses.some((status) => typeof status !== 'string' || !status.trim())) {
      fail('extension', 'board-sync extension is incomplete');
    }
  }
  return config;
}

export function validateDeploymentBranches(branches) {
  if (!Array.isArray(branches) || branches.length < 1 || branches.length > 3) {
    fail('deployment_branches', 'deploymentBranches must contain one, two or three branches');
  }
  const normalized = branches.map((branch) => branch?.toLowerCase());
  if (new Set(normalized).size !== branches.length) fail('deployment_branch_duplicate', 'deployment branch names must be unique');
  for (const branch of branches) {
    if (typeof branch !== 'string' || !branch ||
        !/^[A-Za-z0-9][A-Za-z0-9._/-]*[A-Za-z0-9]$/u.test(branch) ||
        branch.includes('..') || branch.includes('//') || branch.endsWith('.lock') ||
        branch.includes('@{') || safeRelativePath(branch) === false) {
      fail('deployment_branch', `Invalid deployment branch: ${String(branch)}`);
    }
  }
  return branches;
}

export function buildHeroesConfig({
  repository,
  language,
  modelDefaults,
  branches,
  boardSync = false,
  board = {},
  reviewBaseline,
  allowProjectPlaceholder = false,
}) {
  const config = {
    schemaVersion: 1,
    product: 'squad-heroes',
    profile: PROFILE_ID,
    deploymentBranches: branches,
    language,
    modelDefaults,
    repository,
    managed: 'squad-heroes',
    recovery: { planVersion: 1, lastCompletedPlan: null },
    extensions: boardSync ? {
      'board-sync': {
        schemaVersion: 1,
        enabled: true,
        owner: board.owner,
        number: allowProjectPlaceholder && board.number === '{{PROJECT_NUMBER}}'
          ? '{{PROJECT_NUMBER}}'
          : Number(board.number),
        statusField: board.statusField,
        statusMap: board.statusMap,
      },
    } : {},
    ...(reviewBaseline ? { reviewBaseline } : {}),
  };
  if (allowProjectPlaceholder && config.extensions['board-sync']) {
    return validateHeroesConfig(config, { allowProjectPlaceholder: true });
  }
  return validateHeroesConfig(config);
}
