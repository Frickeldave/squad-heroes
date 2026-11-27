#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const dryRun = process.argv.includes('--dry-run');
const initialSync = process.argv.includes('--initial-sync');
const owner = process.env.HEROES_PROJECT_OWNER;
const number = process.env.HEROES_PROJECT_NUMBER;
const field = process.env.HEROES_PROJECT_STATUS_FIELD;
const statuses = JSON.parse(process.env.HEROES_PROJECT_STATUS_MAP ?? '{}');
const repository = process.env.GITHUB_REPOSITORY;
if (!owner || !number || !field || Object.keys(statuses).length === 0 || !repository) {
  throw new Error('Board sync requires complete Project owner, number, field and status mapping');
}

function gh(args) {
  const isProject = args[0] === 'project' ||
    (args[0] === 'api' && args[1] === 'graphql' && args.join(' ').includes('ProjectV2'));
  const token = isProject
    ? process.env.GH_PROJECT_TOKEN
    : (process.env.GH_REPOSITORY_TOKEN ?? process.env.GH_TOKEN);
  if (!token) throw new Error(`Missing ${isProject ? 'Project' : 'repository'} Actions token`);
  let last;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const result = spawnSync('gh', args, {
      encoding: 'utf8',
      env: { ...process.env, GH_TOKEN: token },
    });
    if (result.status === 0) return result.stdout.trim();
    last = result;
    if (attempt < 3) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, attempt * 250);
  }
  throw new Error(`gh failed after retry: ${last?.stderr.trim()}`);
}

function statusFor(labels) {
  const priority = ['go:cancelled', 'go:done', 'go:no', 'go:needs-research', 'go:spec-finished', 'go:yes'];
  const selected = priority.find((label) => labels.includes(label));
  return selected ? statuses[selected] ?? null : null;
}

function records() {
  if (!initialSync) {
    const payload = process.env.GITHUB_EVENT_PATH
      ? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
      : null;
    const item = payload?.issue ?? payload?.pull_request;
    return item ? [item] : [];
  }
  const pages = JSON.parse(gh(['api', `repos/${repository}/issues?per_page=100&state=all`, '--paginate', '--slurp']));
  return pages.flat();
}

const seen = new Set();
const queued = records();
const project = JSON.parse(gh(['project', 'view', number, '--owner', owner, '--format', 'json']));
const fields = JSON.parse(gh(['project', 'field-list', number, '--owner', owner, '--format', 'json']));
const fieldDefinition = fields.fields.find((candidate) => candidate.name === field);
if (!fieldDefinition) throw new Error(`Project field is missing: ${field}`);
for (const status of new Set(Object.values(statuses))) {
  if (!fieldDefinition.options?.some((candidate) => candidate.name === status)) {
    throw new Error(`Project status option is missing: ${status}`);
  }
}
for (const item of queued) {
  const references = item.pull_request?.merged_at
    ? [...(item.body ?? '').matchAll(/\b(?:Closes|Fixes|Resolves)\s+#(\d+)\b/giu)].map((match) => Number(match[1]))
    : [];
  for (const issueNumber of references) {
    try {
      const issue = JSON.parse(gh(['api', `repos/${repository}/issues/${issueNumber}`]));
      queued.push({ ...issue, labels: [...(issue.labels ?? []), { name: 'go:done' }] });
    } catch (error) {
      throw new Error(`closing reference #${issueNumber} could not be resolved: ${error.message}`);
    }
  }
  const key = item.html_url;
  if (!key || seen.has(key)) continue;
  seen.add(key);
  const labels = (item.labels ?? []).map((label) => typeof label === 'string' ? label : label.name);
  const status = statusFor(labels);
  if (!status) continue;
  console.log(`${dryRun ? 'would sync' : 'syncing'} ${key} -> ${status}`);
  if (dryRun) continue;
  const option = fieldDefinition.options.find((candidate) => candidate.name === status);
  let items = JSON.parse(gh(['project', 'item-list', number, '--owner', owner, '--limit', '10000', '--format', 'json']));
  let projectItem = items.items.find((candidate) => candidate.content?.url === key);
  if (!projectItem) {
    gh(['project', 'item-add', number, '--owner', owner, '--url', key]);
    items = JSON.parse(gh(['project', 'item-list', number, '--owner', owner, '--limit', '10000', '--format', 'json']));
    projectItem = items.items.find((candidate) => candidate.content?.url === key);
  }
  if (!projectItem) throw new Error(`Project item not found after add: ${key}`);
  const currentStatus = projectItem.fieldValues?.[field]?.name ?? projectItem.fieldValues?.[field];
  if (currentStatus === status) continue;
  gh(['project', 'item-edit', '--id', projectItem.id, '--project-id', project.id, '--field-id', fieldDefinition.id, '--single-select-option-id', option.id]);
}
