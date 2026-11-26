import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { HeroesError, INCOMPATIBLE_SQUAD_EXIT, fail } from './errors.mjs';
import { readUtf8 } from './io.mjs';

export const SQUAD_VERSION = '2.0.0';
export const SQUAD_AGENT_PATH = '.github/agents/squad.agent.md';

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
  return /^\d+\.\d+\.\d+$/u.test(value) ? value : 'invalid';
}

export function assertSquadCompatibility(repoRoot) {
  const detected = detectSquadVersion(repoRoot);
  if (detected === SQUAD_VERSION) return detected;
  throw new HeroesError(
    'squad_version',
    `ERROR: squad-heroes requires Squad 2.0.0 exactly; detected "${detected}". Installation aborted before mutation.`,
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

export function assertGithubWriteAccess(repository, options = {}) {
  const auth = run('gh', ['auth', 'status'], options);
  if (auth.status !== 0) {
    fail('gh_auth', 'GitHub authentication failed. Run the host-side `gh auth login` browser/device flow and retry.');
  }
  const result = run('gh', ['api', `repos/${repository}`, '--jq', '.permissions.push'], options);
  if (result.status !== 0 || String(result.stdout).trim() !== 'true') {
    fail('gh_permission', `GitHub push permission for ${repository} could not be proven. No mutation was started.`);
  }
  return { repository, push: true };
}
