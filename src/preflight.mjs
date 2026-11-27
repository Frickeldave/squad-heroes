import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { HeroesError, INCOMPATIBLE_SQUAD_EXIT, fail } from './errors.mjs';
import { readUtf8 } from './io.mjs';
import { supportedLanguage, translate } from './messages.mjs';

export const SQUAD_MIN_VERSION = '2.0.0';
export const SQUAD_AGENT_PATH = '.github/agents/squad.agent.md';
export const GITHUB_HOST = 'github.com';
export const VERIFIED_MODEL_FALLBACK = Object.freeze([
  'mai-code-2',
  'claude-sonnet-5.5',
  'gpt-6.1-terra',
]);

function stableSemVer(value) {
  const match = value.match(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/u
  );
  if (!match || match[4]) return null;
  return [BigInt(match[1]), BigInt(match[2]), BigInt(match[3])];
}

function compareVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] > right[index]) return 1;
    if (left[index] < right[index]) return -1;
  }
  return 0;
}

export function detectSquadVersion(repoRoot) {
  const filePath = path.join(repoRoot, SQUAD_AGENT_PATH);
  if (!existsSync(filePath)) return 'missing';
  let source;
  try {
    source = readUtf8(filePath);
  } catch {
    return 'invalid';
  }
  const matches = [...source.matchAll(/<!--\s*version:\s*([^>\s]+)\s*-->/gu)];
  if (matches.length === 0) return 'missing';
  if (matches.length > 1) return 'multiple';
  const value = matches[0][1];
  return stableSemVer(value) ? value : 'invalid';
}

export function assertSquadCompatibility(repoRoot) {
  const detected = detectSquadVersion(repoRoot);
  const version = stableSemVer(detected);
  if (version && compareVersions(version, stableSemVer(SQUAD_MIN_VERSION)) >= 0) return detected;
  throw new HeroesError(
    'squad_version',
    `ERROR: squad-heroes minimum Squad version 2.0.0 is required; detected "${detected}". ` +
    'Installation aborted before mutation. Run `squad upgrade --self` as your normal user; if a root-owned global npm install fails with EACCES or EPERM, repair it with `sudo sh -c \'umask 022 && exec npm install -g --allow-scripts=@bradygaster/squad-cli,node-pty,koffi,protobufjs @bradygaster/squad-cli@latest\'`, not by running Squad itself under sudo. ' +
    'Restart the terminal, run `command -v squad`, `ls -l "$(command -v squad)"`, and `squad --version`, then run `squad upgrade` in the target repository and verify its marker before retrying.',
    { detected, exitCode: INCOMPATIBLE_SQUAD_EXIT }
  );
}

function run(command, args, options = {}) {
  const runner = options.spawn ?? spawnSync;
  return runner(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: options.env ?? process.env,
    ...(options.input !== undefined ? { input: options.input } : {}),
  });
}

function repositoryParts(repository) {
  const match = String(repository ?? '').match(/^([-A-Za-z0-9_.]+)\/[-A-Za-z0-9_.]+$/u);
  if (!match) fail('repository', 'Repository must use owner/name syntax');
  return { owner: match[1], slug: String(repository) };
}

function repositoryOwner(repository) {
  return repositoryParts(repository).owner;
}

function language(options) {
  return supportedLanguage(options.language ?? options.locale ?? process.env.LANG) ?? 'en';
}

function diagnostic(options, id, values) {
  return translate(language(options), id, values).text;
}

function safeGhAccount(value) {
  const login = String(value ?? '').trim();
  return /^(?!-)[A-Za-z0-9-]{1,39}$/u.test(login) ? login : null;
}

function parseAuthScopes(output, account) {
  const text = String(output ?? '').replace(/\x1B\[[0-?]*[ -/]*[@-~]/gu, '');
  const sections = text.split(/\n(?=(?:\s*-\s*)?Logged in to\s+|(?:\s*)github\.com\b)/iu);
  const escapedAccount = account.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const active = sections.find((section) =>
    new RegExp(`\\baccount\\s+${escapedAccount}\\b`, 'iu').test(section)
  ) ?? (sections.length === 1 ? text : '');
  const line = active.match(/Token scopes:\s*([^\r\n]+)/iu)?.[1] ?? '';
  return [...line.matchAll(/['"]([A-Za-z0-9:_-]+)['"]/gu)]
    .map((match) => match[1].toLowerCase())
    .filter((scope, index, scopes) => scopes.indexOf(scope) === index);
}

function scopeStatus(scopes) {
  const status = [];
  if (scopes.includes('project')) status.push('project granted');
  if (scopes.includes('read:project')) status.push('read:project granted');
  if (!status.length) status.push(scopes.length ? 'project scopes absent' : 'project scope unverified');
  return status.join('; ');
}

function safeStatusSummary(result) {
  const stderr = String(result?.stderr ?? '');
  const http = stderr.match(/\bHTTP\s+([1-5]\d\d)\b/iu);
  if (http) return `HTTP ${http[1]}`;
  if (['ENOENT', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT']
    .includes(result?.error?.code)) {
    return `process error ${result.error.code}`;
  }
  if (Number.isInteger(result?.status)) return `exit status ${result.status}`;
  return 'command failed';
}

function stop(category, options, id, values, details = {}) {
  fail(`gh_${category}`, diagnostic(options, id, values), {
    category,
    host: GITHUB_HOST,
    ...details,
  });
}

function assertGhInstalled(result, options) {
  if (result?.error?.code === 'ENOENT') {
    stop('cli_missing', options, 'gh_cli_missing', { host: GITHUB_HOST });
  }
}

export function assertGithubAuthentication(options = {}) {
  const auth = run('gh', ['auth', 'status', '--hostname', GITHUB_HOST], options);
  assertGhInstalled(auth, options);
  if (auth.status !== 0) {
    stop('auth_failed', options, 'gh_auth_failed', {
      host: GITHUB_HOST,
      summary: safeStatusSummary(auth),
      repository: options.repository ?? 'not selected yet',
    }, { summary: safeStatusSummary(auth), repository: options.repository });
  }
  const account = run('gh', ['api', 'user', '--jq', '.login'], options);
  assertGhInstalled(account, options);
  const login = safeGhAccount(account.stdout);
  if (account.status !== 0 || !login) {
    stop('auth_failed', options, 'gh_auth_failed', {
      host: GITHUB_HOST,
      summary: safeStatusSummary(account),
      repository: options.repository ?? 'not selected yet',
    }, { summary: safeStatusSummary(account), repository: options.repository });
  }
  const expectedAccount = safeGhAccount(options.expectedAccount);
  if (options.expectedAccount && !expectedAccount) {
    fail(
      'gh_account_mismatch',
      diagnostic(options, 'gh_account_invalid', { active: login }),
      { category: 'account_mismatch', host: GITHUB_HOST, activeAccount: login }
    );
  }
  if (expectedAccount && expectedAccount.toLowerCase() !== login.toLowerCase()) {
    fail('gh_account_mismatch', diagnostic(options, 'gh_account_mismatch', {
      active: login,
      expected: expectedAccount,
      repository: options.repository ?? 'not selected yet',
      host: GITHUB_HOST,
    }), { category: 'account_mismatch', host: GITHUB_HOST, activeAccount: login, expectedAccount });
  }
  const scopes = parseAuthScopes(`${auth.stdout ?? ''}\n${auth.stderr ?? ''}`, login);
  return {
    account: login,
    host: GITHUB_HOST,
    projectScope: scopes.includes('project'),
    scopes,
    scopeStatus: scopeStatus(scopes),
  };
}

export function assertGithubProjectScope(authentication, options = {}) {
  if (authentication?.projectScope === true) return authentication;
  const active = safeGhAccount(authentication?.account) ?? 'unknown';
  const status = typeof authentication?.scopeStatus === 'string'
    ? authentication.scopeStatus
    : scopeStatus([]);
  stop('project_scope', options, 'gh_project_scope', {
    active,
    owner: options.owner ?? repositoryOwner(options.repository),
    host: GITHUB_HOST,
    summary: status,
    scopeStatus: status,
    project: options.projectNumber ? ` #${options.projectNumber}` : '',
  }, {
    summary: status,
    scopeStatus: status,
    repository: options.repository,
    activeAccount: active,
    owner: options.owner ?? repositoryOwner(options.repository),
  });
  return authentication;
}

export function assertGithubRepositoryAccess(repository, options = {}) {
  const slug = repositoryParts(repository).slug;
  const authentication = options.authentication ?? assertGithubAuthentication({
    ...options,
    repository: slug,
  });
  const login = authentication.account;
  const verification = run('gh', ['api', `repos/${slug}`, '--jq', '.permissions'], options);
  assertGhInstalled(verification, options);
  if (verification.status !== 0) {
    const summary = safeStatusSummary(verification);
    if (summary === 'HTTP 404') {
      stop('repository_not_found', options, 'gh_repository_not_found', {
        active: login,
        repository: slug,
        host: GITHUB_HOST,
        summary,
      }, { summary, repository: slug, activeAccount: login });
    }
    if (summary === 'HTTP 401') {
      stop('auth_failed', options, 'gh_auth_failed', {
        host: GITHUB_HOST,
        summary,
        repository: slug,
      }, { summary, repository: slug, activeAccount: login });
    }
    stop('api_error', options, 'gh_api_error', {
      active: login,
      repository: slug,
      host: GITHUB_HOST,
      summary,
    }, { summary, repository: slug, activeAccount: login });
  }

  let permissions;
  try {
    permissions = JSON.parse(String(verification.stdout));
  } catch {
    permissions = null;
  }
  if (!permissions || typeof permissions !== 'object') {
    stop('api_error', options, 'gh_api_error', {
      active: login,
      repository: slug,
      host: GITHUB_HOST,
      summary: 'invalid permissions response',
    }, { summary: 'invalid permissions response', repository: slug, activeAccount: login });
  }
  const safePermissions = {
    read: permissions.read === true || permissions.pull === true,
    push: permissions.push === true,
    admin: permissions.admin === true,
    triage: permissions.triage === true,
  };
  const renderedPermissions = JSON.stringify(safePermissions);
  if (!safePermissions.read) {
    stop('repository_read_denied', options, 'gh_repository_read_denied', {
      active: login,
      repository: slug,
      host: GITHUB_HOST,
      permissions: renderedPermissions,
    }, { repository: slug, activeAccount: login, permissions: safePermissions });
  }
  if (!safePermissions.push) {
    stop('repository_push_denied', options, 'gh_repository_push_denied', {
      active: login,
      repository: slug,
      host: GITHUB_HOST,
      permissions: renderedPermissions,
    }, { repository: slug, activeAccount: login, permissions: safePermissions });
  }
  return {
    repository: slug,
    owner: repositoryOwner(slug),
    account: login,
    host: GITHUB_HOST,
    ...safePermissions,
  };
}

export function assertGithubWriteAccess(repository, options = {}) {
  return assertGithubRepositoryAccess(repository, options);
}

export function discoverModels(options = {}) {
  const result = run('copilot', ['help', 'config'], options);
  let models = [];
  if (result?.status === 0) {
    const section = String(result.stdout).match(/^\s*`model`:[\s\S]*?(?=^\s*`[A-Za-z])/mu)?.[0] ?? '';
    models = [...section.matchAll(/^\s*-\s+"([^"]+)"\s*$/gmu)]
      .map((match) => match[1])
      .filter((model) => model && model !== 'auto');
  }
  if (!models.length) return { models: [...VERIFIED_MODEL_FALLBACK], fallback: true };
  return { models: [...new Set(models)], fallback: false };
}

function parseProjects(result) {
  try {
    const parsed = JSON.parse(String(result.stdout));
    return Array.isArray(parsed) ? parsed : parsed.projects;
  } catch {
    fail('gh_project', 'GitHub Project discovery returned an invalid response. Confirm Project access and retry.');
  }
}

function projectScopeFailure(owner, repository, options, result, number) {
  const active = safeGhAccount(options.account) ?? 'unknown';
  const summary = safeStatusSummary(result);
  const output = String(result?.stderr ?? '');
  if (/\b(read:project|project)\b/iu.test(output) || /\bscope\b/iu.test(output)) {
    stop('project_scope', options, 'gh_project_scope', {
      active,
      owner,
      host: GITHUB_HOST,
      summary,
      scopeStatus: 'API reported missing or inadequate Project scope',
      project: number ? ` #${number}` : '',
    }, { summary, repository, activeAccount: active, owner, projectNumber: number });
  }
  stop('project_access', options, 'gh_project_access', {
    active,
    owner,
    host: GITHUB_HOST,
    summary,
    project: number ? ` #${number}` : '',
  }, { summary, repository, activeAccount: active, owner, projectNumber: number });
}

export function listBoardProjects(repository, options = {}) {
  const owner = repositoryOwner(repository);
  const listed = run('gh', [
    'project', 'list', '--owner', owner, '--limit', '100', '--format', 'json',
  ], options);
  if (listed.status !== 0) {
    assertGhInstalled(listed, options);
    projectScopeFailure(owner, repository, options, listed);
  }
  const candidates = parseProjects(listed);
  if (!Array.isArray(candidates)) fail('gh_project', 'GitHub Project discovery returned an invalid response.');
  return candidates;
}

export function resolveBoardProject(repository, board = {}, options = {}) {
  const owner = repositoryOwner(repository);
  if (board.owner && board.owner !== owner) {
    fail('project_owner', `Project owner must be derived from repository ${repository}: expected "${owner}".`);
  }
  board.owner = owner;
  const configured = board.number === undefined || board.number === null || board.number === ''
    ? options.configuredNumber
    : board.number;
  let selected;
  if (configured !== undefined && configured !== null && configured !== '') {
    selected = { number: Number(configured) };
    if (!Number.isInteger(selected.number) || selected.number <= 0) {
      fail('project_number', `Project number "${configured}" is invalid; select an available GitHub Project.`);
    }
  } else {
    const candidates = options.projectCatalog ?? listBoardProjects(repository, options);
    if (candidates.length === 0) {
      fail('project_missing', `No GitHub Project is available for "${owner}". Choose Companion Project creation, or cancel and supply/share an existing Project. No mutation was started.`);
    }
    if (candidates.length === 1) selected = candidates[0];
    else {
      fail('project_ambiguous', `Multiple GitHub Projects are available for "${owner}". Pass a validated --project-number override in non-interactive mode or select one from the interactive menu.`);
    }
  }
  const number = Number(selected?.number);
  if (!Number.isInteger(number) || number <= 0) {
    fail('project_number', 'The selected GitHub Project does not have a valid project number.');
  }
  const cached = options.projectCatalog?.find((candidate) => Number(candidate?.number) === number);
  if (!cached) {
    const viewed = run('gh', [
      'project', 'view', String(number), '--owner', owner, '--format', 'json',
    ], options);
    if (viewed.status !== 0) {
      assertGhInstalled(viewed, options);
      projectScopeFailure(owner, repository, options, viewed, number);
    }
    try {
      const value = JSON.parse(String(viewed.stdout));
      if (Number(value.number ?? number) !== number) throw new Error('number mismatch');
    } catch {
      fail('gh_project', `GitHub Project #${number} for "${owner}" returned an invalid response. No mutation was started.`);
    }
  }
  board.number = number;
  return { ...board, owner, number };
}

export function validateProjectTitle(value) {
  const title = String(value ?? '').trim();
  if (
    title.length < 1 ||
    title.length > 120 ||
    title !== String(value ?? '') ||
    /[\u0000-\u001f\u007f]/u.test(title) ||
    /^(?:\.{1,2}|untitled|project)$/iu.test(title)
  ) {
    fail('project_title', 'Project title must be explicit, 1-120 printable characters, trimmed, and not generic or ambiguous.');
  }
  return title;
}

export function resolveProjectOwnerForCreate(repository, title, options = {}) {
  const owner = repositoryOwner(repository);
  const safeTitle = validateProjectTitle(title);
  const authentication = options.authentication ?? assertGithubAuthentication({ ...options, repository });
  assertGithubProjectScope(authentication, { ...options, repository, owner });
  const query = 'query($login:String!){organization(login:$login){id login __typename viewerCanAdminister}user(login:$login){id login __typename isViewer}}';
  const result = run('gh', [
    'api', 'graphql', '-f', `query=${query}`, '-F', `login=${owner}`,
  ], options);
  if (result.status !== 0) {
    assertGhInstalled(result, options);
    projectScopeFailure(owner, repository, options, result);
  }
  let payload;
  try {
    payload = JSON.parse(String(result.stdout));
  } catch {
    fail('gh_project_owner', `GitHub owner "${owner}" returned an invalid identity response. No mutation was started.`);
  }
  const organization = payload?.data?.organization;
  const user = payload?.data?.user;
  const identity = organization ?? user;
  if (!identity || (organization && user) || typeof identity.id !== 'string' || !identity.id) {
    fail('gh_project_owner', `GitHub could not resolve exactly one owner identity for "${owner}". No mutation was started.`);
  }
  if (identity.login?.toLowerCase() !== owner.toLowerCase()) {
    fail('gh_project_owner', `GitHub owner identity does not match derived owner "${owner}". No mutation was started.`);
  }
  const ownerMutable = organization
    ? identity.viewerCanAdminister === true
    : identity.isViewer === true;
  if (!ownerMutable) {
    stop('project_create_denied', options, 'gh_project_create_access', {
      active: authentication.account,
      owner,
      host: GITHUB_HOST,
      kind: identity.__typename ?? (organization ? 'Organization' : 'User'),
      summary: 'owner update capability is false (403)',
    }, {
      summary: 'owner update capability is false (403)',
      repository,
      activeAccount: authentication.account,
      owner,
      ownerId: identity.id,
    });
  }
  return {
    owner,
    ownerId: identity.id,
    ownerType: identity.__typename ?? (organization ? 'Organization' : 'User'),
    title: safeTitle,
    ownerMutable: true,
  };
}

export function createBoardProject(repository, ownerIdentity, options = {}) {
  const authentication = options.authentication ?? assertGithubAuthentication({ ...options, repository });
  assertGithubProjectScope(authentication, { ...options, repository, owner: ownerIdentity.owner });
  const verifiedOwner = resolveProjectOwnerForCreate(
    repository,
    ownerIdentity.title,
    { ...options, authentication }
  );
  if (verifiedOwner.ownerId !== ownerIdentity.ownerId || verifiedOwner.ownerType !== ownerIdentity.ownerType) {
    fail('gh_project_owner', 'GitHub Project owner identity changed after planning. No Project was created.');
  }
  const current = listBoardProjects(repository, {
    ...options,
    account: authentication.account,
  });
  const sameTitles = current.filter((project) =>
    String(project.title ?? project.name ?? '') === verifiedOwner.title
  );
  if (sameTitles.length > 1) {
    fail('project_ambiguous', `Multiple GitHub Projects are already named "${verifiedOwner.title}". Refusing to create a duplicate.`);
  }
  if (sameTitles.length === 1) {
    const number = Number(sameTitles[0].number);
    if (!Number.isInteger(number) || number <= 0) {
      fail('project_number', 'The matching recovery Project has no valid number.');
    }
    return assertProjectWriteAccess(repository, { owner: verifiedOwner.owner, number }, {
      ...options,
      authentication,
      projectCatalog: current,
    });
  }
  const query = 'mutation($ownerId:ID!,$title:String!){createProjectV2(input:{ownerId:$ownerId,title:$title}){projectV2{id number title viewerCanUpdate}}}';
  const result = run('gh', [
    'api', 'graphql', '-f', `query=${query}`,
    '-F', `ownerId=${verifiedOwner.ownerId}`, '-f', `title=${verifiedOwner.title}`,
  ], options);
  if (result.status !== 0) {
    assertGhInstalled(result, options);
    projectScopeFailure(verifiedOwner.owner, repository, options, result);
  }
  let payload;
  try {
    payload = JSON.parse(String(result.stdout));
  } catch {
    fail('gh_project_create', 'GitHub Project creation returned an invalid response. No local state was written; inspect and recover manually.');
  }
  const created = payload?.data?.createProjectV2?.projectV2;
  if (!created || created.viewerCanUpdate !== true ||
      !Number.isInteger(Number(created.number)) || Number(created.number) <= 0 ||
      typeof created.id !== 'string' || !created.id) {
    fail('gh_project_create', 'GitHub did not return a writable Project node and number. No local state was written; inspect and recover manually.');
  }
  if (created.title !== verifiedOwner.title) {
    fail('gh_project_create', 'GitHub returned a Project with an unexpected title. No local state was written; inspect and recover manually.');
  }
  return { owner: verifiedOwner.owner, number: Number(created.number), id: created.id, title: created.title };
}

export function configureBoardProject(repository, board, options = {}) {
  const owner = repositoryOwner(repository);
  const number = Number(board.number);
  const fieldName = String(board.statusField ?? '').trim();
  const statuses = [...new Set(Object.values(board.statusMap ?? {}))];
  if (!fieldName || statuses.length === 0 ||
      statuses.some((status) => typeof status !== 'string' || !status.trim())) {
    fail('project_schema', 'Project schema requires a non-empty status field and status option names.');
  }
  const listed = run('gh', [
    'project', 'field-list', String(number), '--owner', owner, '--format', 'json',
  ], options);
  if (listed.status !== 0) {
    assertGhInstalled(listed, options);
    projectScopeFailure(owner, repository, options, listed, number);
  }
  let fields;
  try {
    fields = JSON.parse(String(listed.stdout)).fields;
  } catch {
    fail('project_schema', 'GitHub Project field discovery returned an invalid response.');
  }
  if (!Array.isArray(fields)) fail('project_schema', 'GitHub Project field discovery returned no fields array.');
  let field = fields.find((candidate) => candidate.name === fieldName);
  if (!field) {
    const created = run('gh', [
      'project', 'field-create', String(number), '--owner', owner,
      '--name', fieldName, '--data-type', 'SINGLE_SELECT',
      '--single-select-options', statuses.join(','), '--format', 'json',
    ], options);
    if (created.status !== 0) {
      assertGhInstalled(created, options);
      if (/\bscope\b/iu.test(String(created.stderr ?? ''))) {
        projectScopeFailure(owner, repository, options, created, number);
      }
      fail('project_schema', `Could not create Project field "${fieldName}" (${safeStatusSummary(created)}). The Project creation already occurred and no local state was written; inspect/recover the Project schema manually without creating another Project.`);
    }
    field = { id: JSON.parse(String(created.stdout)).id, name: fieldName, options: statuses.map((name) => ({ name })) };
  } else {
    const existingOptions = Array.isArray(field.options) ? field.options : [];
    const missing = statuses.filter((status) => !existingOptions.some((option) => option.name === status));
    if (missing.length) {
      const query = 'mutation($input:UpdateProjectV2FieldInput!){updateProjectV2Field(input:$input){clientMutationId}}';
      const input = {
        fieldId: field.id,
        singleSelectOptions: [
          ...existingOptions.map((option) => ({
            ...(option.id ? { id: option.id } : {}),
            name: option.name,
            color: option.color ?? 'GRAY',
            description: option.description ?? '',
          })),
          ...missing.map((name) => ({ name, color: 'GRAY', description: '' })),
        ],
      };
      const updated = run('gh', ['api', 'graphql', '--input', '-'], {
        ...options,
        input: JSON.stringify({ query, variables: { input } }),
      });
      if (updated.status !== 0) {
        assertGhInstalled(updated, options);
        fail('project_schema', `Could not add Project status options for "${fieldName}". The Project may be partially configured; recover manually from this safe plan. ${safeStatusSummary(updated)}`);
      }
    }
  }
  return { number, fieldId: field.id, fieldName, statuses };
}

export function inspectBoardProjectSchema(repository, board, options = {}) {
  const owner = repositoryOwner(repository);
  const number = Number(board.number);
  const fieldName = String(board.statusField ?? '').trim();
  const statuses = [...new Set(Object.values(board.statusMap ?? {}))];
  if (!Number.isInteger(number) || number <= 0 || !fieldName ||
      statuses.length === 0 || statuses.some((status) => typeof status !== 'string' || !status.trim())) {
    fail('project_schema', 'Project schema requires an existing number, status field and status option names.');
  }
  const listed = run('gh', [
    'project', 'field-list', String(number), '--owner', owner, '--format', 'json',
  ], options);
  if (listed.status !== 0) {
    assertGhInstalled(listed, options);
    projectScopeFailure(owner, repository, options, listed, number);
  }
  let fields;
  try {
    fields = JSON.parse(String(listed.stdout)).fields;
  } catch {
    fail('project_schema', 'GitHub Project field discovery returned an invalid response.');
  }
  if (!Array.isArray(fields)) fail('project_schema', 'GitHub Project field discovery returned no fields array.');
  const field = fields.find((candidate) => candidate.name === fieldName);
  const present = new Set(field?.options?.map((option) => option.name) ?? []);
  return {
    fieldExists: Boolean(field),
    fieldId: field?.id ?? null,
    missingOptions: statuses.filter((status) => !present.has(status)),
  };
}

export function linkBoardProject(repository, project, options = {}) {
  const repositoryNode = run('gh', [
    'api', 'graphql', '-f',
    'query=query($owner:String!,$name:String!){repository(owner:$owner,name:$name){id}}',
    '-F', `owner=${repositoryOwner(repository)}`,
    '-F', `name=${repository.split('/')[1]}`,
  ], options);
  if (repositoryNode.status !== 0) projectScopeFailure(repositoryOwner(repository), repository, options, repositoryNode);
  let repoId;
  try {
    repoId = JSON.parse(String(repositoryNode.stdout)).data.repository.id;
  } catch {
    fail('project_link', 'GitHub repository node ID could not be resolved for Project linkage.');
  }
  const linkedCheck = run('gh', [
    'api', 'graphql', '-f',
    'query=query($projectId:ID!){node(id:$projectId){... on ProjectV2{repositories(first:100){nodes{id}}}}}',
    '-F', `projectId=${project.id}`,
  ], options);
  if (linkedCheck.status === 0) {
    try {
      const repositories = JSON.parse(String(linkedCheck.stdout)).data.node.repositories.nodes;
      if (repositories.some((candidate) => candidate.id === repoId)) {
        return { projectId: project.id, repositoryId: repoId, linked: true };
      }
    } catch {
      fail('project_link', 'GitHub Project repository links returned an invalid response. No local state was written.');
    }
  }
  const query = 'mutation($projectId:ID!,$repositoryId:ID!){linkProjectV2ToRepository(input:{projectId:$projectId,repositoryId:$repositoryId}){clientMutationId}}';
  const linked = run('gh', [
    'api', 'graphql', '-f', `query=${query}`,
    '-F', `projectId=${project.id}`, '-F', `repositoryId=${repoId}`,
  ], options);
  if (linked.status !== 0) {
    const output = String(linked.stderr ?? '');
    if (/already linked/iu.test(output)) return { projectId: project.id, repositoryId: repoId, linked: true };
    assertGhInstalled(linked, options);
    fail('project_link', `GitHub Project repository linkage failed (${safeStatusSummary(linked)}). No local state was written; recover this linkage manually.`);
  }
  return { projectId: project.id, repositoryId: repoId, linked: true };
}
export function assertProjectWriteAccess(repository, board, options = {}) {
  const authentication = options.authentication ?? assertGithubAuthentication({
    ...options,
    repository,
  });
  const owner = repositoryOwner(repository);
  assertGithubProjectScope(authentication, {
    ...options,
    repository,
    owner,
    projectNumber: board.number,
  });
  const resolved = resolveBoardProject(repository, { ...board }, {
    ...options,
    account: authentication.account,
    authentication,
  });
  const query = 'query($login:String!,$number:Int!){organization(login:$login){projectV2(number:$number){id viewerCanUpdate}}user(login:$login){projectV2(number:$number){id viewerCanUpdate}}}';
  const verification = run('gh', [
    'api', 'graphql',
    '-f', `query=${query}`,
    '-F', `login=${resolved.owner}`,
    '-F', `number=${resolved.number}`,
  ], options);
  assertGhInstalled(verification, options);
  const summary = safeStatusSummary(verification);
  if (verification.status !== 0) {
    stop('project_access', options, 'gh_project_write_access', {
      active: authentication.account,
      owner: resolved.owner,
      host: GITHUB_HOST,
      summary,
      project: ` #${resolved.number}`,
      number: resolved.number,
    }, {
      summary,
      repository,
      activeAccount: authentication.account,
      owner: resolved.owner,
      projectNumber: resolved.number,
    });
  }
  let payload;
  try {
    payload = JSON.parse(String(verification.stdout));
  } catch {
    payload = null;
  }
  const project = payload?.data?.organization?.projectV2 ?? payload?.data?.user?.projectV2;
  if (!project || project.viewerCanUpdate !== true) {
    stop('project_write_denied', options, 'gh_project_write_access', {
      active: authentication.account,
      owner: resolved.owner,
      host: GITHUB_HOST,
      summary: project ? 'write access is false' : 'Project not found or not visible (404)',
      project: ` #${resolved.number}`,
      number: resolved.number,
    }, {
      summary: project ? 'write access is false' : 'Project not found or not visible (404)',
      repository,
      activeAccount: authentication.account,
      owner: resolved.owner,
      projectNumber: resolved.number,
    });
  }
  return { ...resolved, id: project.id, viewerCanUpdate: project.viewerCanUpdate };
}

export function preflightGithubAccess(repository, options = {}) {
  const authentication = options.authentication ?? assertGithubAuthentication(options);
  const access = assertGithubRepositoryAccess(repository, {
    ...options,
    authentication,
    repository,
  });
  assertGithubProjectScope(authentication, {
    ...options,
    repository,
    owner: access.owner,
  });
  const projects = listBoardProjects(repository, {
    ...options,
    repository,
    account: access.account,
  });
  return { ...access, projects, projectScope: authentication.projectScope, scopeStatus: authentication.scopeStatus };
}

export function assertReviewBaseline(repoRoot, baseline, options = {}) {
  if (!baseline) return undefined;
  const result = run('git', ['-C', repoRoot, 'rev-parse', '--verify', `${baseline}^{commit}`], options);
  const resolved = String(result.stdout ?? '').trim();
  if (result.status !== 0 || !/^[0-9a-f]{40,64}$/u.test(resolved)) {
    fail('review_baseline', `Review baseline "${baseline}" is not a provable commit in the target repository.`);
  }
  return resolved;
}
