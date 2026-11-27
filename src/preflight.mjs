import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { HeroesError, INCOMPATIBLE_SQUAD_EXIT, fail } from './errors.mjs';
import { readUtf8 } from './io.mjs';

export const SQUAD_MIN_VERSION = '2.0.0';
export const SQUAD_AGENT_PATH = '.github/agents/squad.agent.md';
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
  });
}

function repositoryOwner(repository) {
  const match = String(repository ?? '').match(/^([-A-Za-z0-9_.]+)\/[-A-Za-z0-9_.]+$/u);
  if (!match) fail('repository', 'Repository must use owner/name syntax');
  return match[1];
}

function ghFailure(action, result) {
  if (result?.error?.code === 'ENOENT') {
    fail('gh_host', 'GitHub CLI is unavailable. Install `gh` on the host and run `gh auth login`, then retry.');
  }
  if (action === 'auth') {
    fail('gh_auth', 'GitHub authentication failed. Run the host-side `gh auth login` browser/device flow, then retry. No token is accepted by the installer.');
  }
  throw result?.error ?? new Error(result?.stderr || `GitHub ${action} check failed`);
}

export function assertGithubWriteAccess(repository, options = {}) {
  const auth = run('gh', ['auth', 'status'], options);
  if (auth.status !== 0) ghFailure('auth', auth);
  const account = run('gh', ['api', 'user', '--jq', '.login'], options);
  if (account.status !== 0 || !String(account.stdout).trim()) {
    fail('gh_auth', 'The authenticated GitHub account could not access GitHub. Run `gh auth login` on the host and confirm account access, then retry.');
  }
  const read = run('gh', ['api', `repos/${repository}`, '--jq', '.permissions.pull'], options);
  const push = run('gh', ['api', `repos/${repository}`, '--jq', '.permissions.push'], options);
  if (read.status !== 0 || String(read.stdout).trim() !== 'true') {
    fail('gh_permission', `Repository read permission for ${repository} could not be proven. Confirm the authenticated account can access the repository or ask an owner to grant access; refresh host auth with the required repo scope if needed. No mutation was started.`);
  }
  if (push.status !== 0 || String(push.stdout).trim() !== 'true') {
    fail('gh_permission', `Repository push permission for ${repository} could not be proven. Ask a repository owner for push access or run host-side \`gh auth login\` with the required repo scopes, then retry. No mutation was started.`);
  }
  return { repository, owner: repositoryOwner(repository), account: String(account.stdout).trim(), read: true, push: true };
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

export function listBoardProjects(repository, options = {}) {
  const owner = repositoryOwner(repository);
  const listed = run('gh', [
    'project', 'list', '--owner', owner, '--limit', '100', '--format', 'json',
  ], options);
  if (listed.status !== 0) {
    fail('gh_project', 'GitHub Project access could not be proven. Run host-side `gh auth refresh -s read:project,project` (or `gh auth login`), then confirm the authenticated account can access this owner’s Projects. No mutation was started.');
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
    const candidates = listBoardProjects(repository, options);
    if (candidates.length === 0) {
      fail('project_missing', `No GitHub Project is available for "${owner}". Create or share a Project with the authenticated account, then rerun after granting the required Project scopes. No mutation was started.`);
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
  const viewed = run('gh', [
    'project', 'view', String(number), '--owner', owner, '--format', 'json',
  ], options);
  if (viewed.status !== 0) {
    fail('gh_project', `GitHub Project #${number} for "${owner}" could not be read. Confirm Project access or run host-side \`gh auth refresh -s read:project,project\`, then retry. No mutation was started.`);
  }
  try {
    const value = JSON.parse(String(viewed.stdout));
    if (Number(value.number ?? number) !== number) throw new Error('number mismatch');
  } catch {
    fail('gh_project', `GitHub Project #${number} for "${owner}" returned an invalid response. No mutation was started.`);
  }
  board.number = number;
  return { ...board, owner, number };
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
