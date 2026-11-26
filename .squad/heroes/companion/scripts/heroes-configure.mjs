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
for (const slug of slugs) {
  const name = `squad:${slug}`;
  if (current.has(name)) continue;
  console.log(`${checkOnly ? 'would create' : 'creating'} label ${name}`);
  if (!checkOnly) gh(['label', 'create', name, '--color', '0366d6', '--description', `Assigned to Squad member ${slug}`]);
}

if (process.env.HEROES_CONFIGURE_PROJECT === 'true') {
  const required = ['HEROES_PROJECT_OWNER', 'HEROES_PROJECT_NUMBER', 'HEROES_PROJECT_STATUS_FIELD'];
  if (required.some((name) => !process.env[name])) throw new Error('complete project configuration is required');
  gh(['project', 'view', process.env.HEROES_PROJECT_NUMBER, '--owner', process.env.HEROES_PROJECT_OWNER, '--format', 'json']);
  console.log('Project configuration validated; schema creation is intentionally consumer-configured.');
}
