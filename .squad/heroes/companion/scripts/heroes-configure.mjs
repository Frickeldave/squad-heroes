#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

function gh(args) {
  const result = spawnSync('gh', args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`gh ${args[0]} failed: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

const roster = ['.squad/team.md', '.ai-team/team.md'].find(existsSync);
if (!roster) throw new Error('roster file is missing');
const source = readFileSync(roster, 'utf8');
const rows = [...source.matchAll(/^\|\s*([^|]+)\s*\|/gmu)].map((match) => match[1].trim().toLowerCase());
const slugs = [...new Set(rows)].filter((row) => /^[a-z0-9][a-z0-9-]*$/u.test(row) && !['name', '---'].includes(row));
if (slugs.length === 0) throw new Error('roster has no valid member table rows');
const checkOnly = process.env.HEROES_CHECK_ONLY === 'true';
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

if (process.env.HEROES_CONFIGURE_PROJECT === 'true') {
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
  gh(['project', 'view', process.env.HEROES_PROJECT_NUMBER, '--owner', process.env.HEROES_PROJECT_OWNER, '--format', 'json']);
  const fields = JSON.parse(gh([
    'project', 'field-list', process.env.HEROES_PROJECT_NUMBER,
    '--owner', process.env.HEROES_PROJECT_OWNER, '--format', 'json',
  ]));
  const existing = fields.fields.find(({ name }) => name === process.env.HEROES_PROJECT_STATUS_FIELD);
  if (!existing) {
    console.log(`${checkOnly ? 'would create' : 'creating'} Project field ${process.env.HEROES_PROJECT_STATUS_FIELD}`);
    if (!checkOnly) {
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
