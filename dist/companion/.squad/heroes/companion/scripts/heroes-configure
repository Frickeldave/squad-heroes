#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

function projectCommand(args) {
  return args[0] === 'project' ||
    (args[0] === 'api' && args[1] === 'graphql' && args.join(' ').includes('ProjectV2'));
}

function gh(args) {
  const isProject = projectCommand(args);
  const token = isProject
    ? process.env.GH_PROJECT_TOKEN
    : (process.env.GH_REPOSITORY_TOKEN ?? process.env.GH_TOKEN);
  if (!token) throw new Error(`Missing ${isProject ? 'Project' : 'repository'} Actions token`);
  const result = spawnSync('gh', args, {
    encoding: 'utf8',
    env: { ...process.env, GH_TOKEN: token },
  });
  if (result.status !== 0) throw new Error(`gh ${args[0]} failed (exit status ${result.status})`);
  return result.stdout.trim();
}

function graphqlErrorBranch(error) {
  const path = Array.isArray(error?.path) ? error.path[0] : null;
  if (path === 'organization' || path === 'user') return path;
  if (/organization/iu.test(String(error?.message ?? ''))) return 'organization';
  if (/\buser\b/iu.test(String(error?.message ?? ''))) return 'user';
  return null;
}

function validPartialGraphql(result, payload, matchingBranch) {
  const errors = Array.isArray(payload?.errors) ? payload.errors : [];
  if (result.status === 0) return errors.length === 0;
  if (matchingBranch === 'repositoryOwner') return false;
  if (errors.length === 0 || errors.some((error) => {
    const code = String(error?.extensions?.code ?? error?.type ?? '').toUpperCase();
    const notFound = code === 'NOT_FOUND' ||
      /could not resolve to an? (organization|user)/iu.test(String(error?.message ?? ''));
    return !notFound || !graphqlErrorBranch(error) || graphqlErrorBranch(error) === matchingBranch;
  })) return false;
  const stderr = String(result.stderr ?? '').trim();
  return !stderr || stderr.split(/\r?\n/u).every((line) =>
    !line.trim() ||
    /^(?:gh:\s*)?(?:GraphQL:\s*)?Could not resolve to an? (?:Organization|User)\b.*$/iu.test(line.trim())
  );
}

function graphql(args) {
  const token = process.env.GH_PROJECT_TOKEN;
  if (!token) throw new Error('Missing Project Actions token');
  const result = spawnSync('gh', args, {
    encoding: 'utf8',
    env: { ...process.env, GH_TOKEN: token },
  });
  let payload;
  try {
    payload = JSON.parse(String(result.stdout));
  } catch {
    throw new Error(`gh api graphql failed (exit status ${result.status}).`);
  }
  return { result, payload };
}

function requireProjectScope() {
  if (!process.env.GH_PROJECT_TOKEN) throw new Error('Missing Project Actions token');
  const result = spawnSync('gh', ['auth', 'status', '--hostname', 'github.com'], {
    encoding: 'utf8',
    env: { ...process.env, GH_TOKEN: process.env.GH_PROJECT_TOKEN },
  });
  if (result.status !== 0) throw new Error('GitHub authentication is unavailable. Run `gh auth status --hostname github.com`.');
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.replace(/\x1B\[[0-?]*[ -/]*[@-~]/gu, '');
  const scopeLine = output.match(/Token scopes:\s*([^\r\n]+)/iu)?.[1] ?? '';
  const scopes = [...scopeLine.matchAll(/['"]([A-Za-z0-9:_-]+)['"]/gu)].map((match) => match[1]);
  if (!scopes.includes('project')) {
    throw new Error(
      'GitHub Board setup requires the write-capable `project` scope. Run:\n' +
      '`gh auth refresh -h github.com -s project`\nthen\n' +
      '`gh auth status --hostname github.com`\nNo token is requested. No mutation started.'
    );
  }
}

function requireProjectWriteAccess() {
  const owner = process.env.HEROES_PROJECT_OWNER;
  const number = process.env.HEROES_PROJECT_NUMBER;
  const identityQuery = 'query($login:String!){repositoryOwner(login:$login){id login __typename}}';
  const identityResult = graphql([
    'api', 'graphql', '-f', `query=${identityQuery}`, '-F', `login=${owner}`,
  ]);
  const directIdentity = identityResult.payload.data?.repositoryOwner;
  const organizationIdentity = identityResult.payload.data?.organization;
  const userIdentity = identityResult.payload.data?.user;
  const identity = directIdentity ?? organizationIdentity ?? userIdentity;
  const identityType = identity?.__typename === 'Organization' || identity?.__typename === 'User'
    ? identity.__typename
    : organizationIdentity ? 'Organization' : userIdentity ? 'User' : null;
  const identityBranch = directIdentity ? 'repositoryOwner' :
    organizationIdentity ? 'organization' : 'user';
  if (
    (organizationIdentity && userIdentity) ||
    !identity ||
    !identityType ||
    typeof identity.id !== 'string' ||
    !identity.id ||
    identity.login?.toLowerCase() !== String(owner).toLowerCase() ||
    !validPartialGraphql(identityResult.result, identityResult.payload, identityBranch)
  ) {
    throw new Error(`GitHub Project owner "${owner}" could not be resolved as a User or Organization.`);
  }
  const branch = identityType === 'Organization' ? 'organization' : 'user';
  const query = `query($login:String!,$number:Int!){${branch}(login:$login){projectV2(number:$number){id number viewerCanUpdate}}}`;
  const verification = graphql([
    'api', 'graphql',
    '-f', `query=${query}`,
    '-F', `login=${owner}`,
    '-F', `number=${number}`,
  ]);
  const project = verification.payload.data?.[branch]?.projectV2;
  if (
    !validPartialGraphql(verification.result, verification.payload, branch) ||
    !project ||
    typeof project.id !== 'string' ||
    !project.id ||
    Number(project.number) !== Number(number) ||
    project.viewerCanUpdate !== true
  ) {
    throw new Error(
      `GitHub Project #${number} for "${owner}" is not writable or visible (403/404). ` +
      'Ask a Project owner/admin for write access and verify organization policy. No Project mutation started.'
    );
  }
}

function projectConfiguration() {
  if (process.env.HEROES_CONFIGURE_PROJECT !== 'true') return null;
  const required = [
    'HEROES_PROJECT_OWNER',
    'HEROES_PROJECT_NUMBER',
    'HEROES_PROJECT_STATUS_FIELD',
    'HEROES_PROJECT_STATUS_MAP',
  ];
  if (required.some((name) => !process.env[name])) throw new Error('complete project configuration is required');
  const statuses = JSON.parse(process.env.HEROES_PROJECT_STATUS_MAP);
  const values = [...new Set(Object.values(statuses))];
  if (values.length === 0 || values.some((value) => typeof value !== 'string' || !value)) {
    throw new Error('project status mapping must contain non-empty status names');
  }
  requireProjectScope();
  requireProjectWriteAccess();
  return { values };
}

const roster = ['.squad/team.md', '.ai-team/team.md'].find(existsSync);
if (!roster) throw new Error('roster file is missing');
const source = readFileSync(roster, 'utf8');
const rows = [...source.matchAll(/^\|\s*([^|]+)\s*\|/gmu)].map((match) => match[1].trim().toLowerCase());
const slugs = [...new Set(rows)].filter((row) => /^[a-z0-9][a-z0-9-]*$/u.test(row) && !['name', '---'].includes(row));
if (slugs.length === 0) throw new Error('roster has no valid member table rows');
const checkOnly = process.env.HEROES_CHECK_ONLY === 'true';
const projectConfig = projectConfiguration();
const current = new Set(JSON.parse(gh(['label', 'list', '--limit', '1000', '--json', 'name'])).map(({ name }) => name));
const labels = [
  ...slugs.map((slug) => ({
    name: `squad:${slug}`,
    color: '0366d6',
    description: `Assigned to Squad member ${slug}`,
  })),
  { name: 'squad', color: '5319e7', description: 'Squad triage inbox' },
  { name: 'release:yes', color: '0e8a16', description: 'Versioned release' },
  { name: 'release:no', color: '6a737d', description: 'No release version change' },
];
for (const label of labels) {
  const { name, color, description } = label;
  if (current.has(name)) continue;
  console.log(`${checkOnly ? 'would create' : 'creating'} label ${name}`);
  if (!checkOnly) gh(['label', 'create', name, '--color', color, '--description', description]);
}

if (projectConfig) {
  const { values } = projectConfig;
  gh(['project', 'view', process.env.HEROES_PROJECT_NUMBER, '--owner', process.env.HEROES_PROJECT_OWNER, '--format', 'json']);
  const fields = JSON.parse(gh([
    'project', 'field-list', process.env.HEROES_PROJECT_NUMBER,
    '--owner', process.env.HEROES_PROJECT_OWNER, '--format', 'json',
  ]));
  const existing = fields.fields.find(({ name }) => name === process.env.HEROES_PROJECT_STATUS_FIELD);
  if (!existing) {
    console.log(`${checkOnly ? 'would create' : 'creating'} Project field ${process.env.HEROES_PROJECT_STATUS_FIELD}`);
    if (!checkOnly) {
      requireProjectWriteAccess();
      gh([
        'project', 'field-create', process.env.HEROES_PROJECT_NUMBER,
        '--owner', process.env.HEROES_PROJECT_OWNER,
        '--name', process.env.HEROES_PROJECT_STATUS_FIELD,
        '--data-type', 'SINGLE_SELECT',
        '--single-select-options', values.join(','),
      ]);
    }
  } else {
    const options = new Set(existing.options?.map(({ name }) => name) ?? []);
    const missing = values.filter((value) => !options.has(value));
    if (missing.length) throw new Error(`Project field is missing status options: ${missing.join(', ')}`);
  }
  console.log('Project configuration validated.');
}
