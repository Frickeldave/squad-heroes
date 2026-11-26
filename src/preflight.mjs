import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { HeroesError, INCOMPATIBLE_SQUAD_EXIT, fail } from './errors.mjs';
import { readUtf8 } from './io.mjs';

export const SQUAD_MIN_VERSION = '2.0.0';
export const SQUAD_AGENT_PATH = '.github/agents/squad.agent.md';

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
