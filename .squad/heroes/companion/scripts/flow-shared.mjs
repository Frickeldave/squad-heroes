import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const FLOWS = new Set(['reqeng', 'work', 'review']);

export function requireSquad2() {
  const source = readFileSync('.github/agents/squad.agent.md', 'utf8');
  const matches = [...source.matchAll(/<!--\s*version:\s*([^>\s]+)\s*-->/gu)];
  const version = matches.length === 1 ? matches[0][1] : matches.length ? 'multiple' : 'missing';
  if (version !== '2.0.0') {
    console.error(`ERROR: squad-heroes requires Squad 2.0.0 exactly; detected "${version}". Installation aborted before mutation.`);
    process.exit(2);
  }
}

export function loadConfig() {
  const state = JSON.parse(readFileSync('.squad/heroes.json', 'utf8'));
  if (state.schemaVersion !== 1 || state.product !== 'squad-heroes' ||
      state.profile !== 'typescript-development') throw new Error('invalid heroes.json');
  return state;
}

export async function resolveModel(flow, argv) {
  if (!FLOWS.has(flow)) throw new Error(`unknown flow: ${flow}`);
  const index = argv.indexOf('--model');
  const inline = argv.find((arg) => arg.startsWith('--model='));
  const override = index === -1 ? inline?.slice('--model='.length) : argv[index + 1];
  const model = override ?? loadConfig().modelDefaults?.[flow];
  if (!model || model === 'auto') throw new Error(`no explicit model for ${flow}`);
  const token = spawnSync('gh', ['auth', 'token'], { encoding: 'utf8' });
  if (token.status !== 0 || !token.stdout.trim()) throw new Error('host GitHub authentication is unavailable');
  const catalog = await fetch('https://api.githubcopilot.com/models', {
    headers: {
      Authorization: `Bearer ${token.stdout.trim()}`,
      'Copilot-Integration-Id': 'copilot-developer-cli',
    },
    signal: AbortSignal.timeout(4000),
  });
  if (!catalog.ok) throw new Error('authorized Copilot model catalog is unavailable');
  const payload = await catalog.json();
  const entries = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
  if (!entries.some((entry) => entry?.id === model &&
      entry?.capabilities?.type === 'chat' &&
      entry?.model_picker_enabled === true &&
      entry?.policy?.state !== 'disabled')) {
    throw new Error(`model is not provably available for ${flow}: ${model}`);
  }
  return model;
}

export function additionalPrompt(argv, base) {
  const index = argv.indexOf('--prompt');
  const inline = argv.find((arg) => arg.startsWith('--prompt='));
  const extra = index >= 0 ? argv[index + 1] : inline?.slice('--prompt='.length);
  if (!extra) return base;
  return `${base}\n\n---\n\n${extra}`;
}

export function resolveReviewBaseline(config, argv) {
  const explicit = argv.find((arg) => arg.startsWith('--baseline='));
  const configured = explicit ? explicit.slice('--baseline='.length) : config.reviewBaseline;
  if (configured) {
    const resolved = spawnSync('git', ['rev-parse', '--verify', `${configured}^{commit}`], { encoding: 'utf8' });
    if (resolved.status !== 0 || !/^[0-9a-f]{40,64}$/u.test(resolved.stdout.trim())) {
      throw new Error(`review baseline is not a provable commit: ${configured}`);
    }
    return resolved.stdout.trim();
  }
  const prIndex = argv.indexOf('--pr');
  const pr = prIndex >= 0 ? argv[prIndex + 1] : null;
  if (!pr || !/^\d+$/u.test(pr)) throw new Error('review requires --baseline, project baseline, or --pr for PR-base resolution');
  const result = spawnSync('gh', ['pr', 'view', pr, '--repo', config.repository, '--json', 'baseRefOid', '--jq', '.baseRefOid'], {
    encoding: 'utf8',
  });
  if (result.status !== 0 || !/^[0-9a-f]{40,64}$/u.test(result.stdout.trim())) {
    throw new Error('PR base could not be resolved; PR head is never a baseline');
  }
  return result.stdout.trim();
}

export function launchCopilot(model, prompt, argv) {
  if (argv.includes('--plan')) return { planned: true };
  const result = spawnSync('copilot', ['--agent', 'Squad', '--yolo', '--model', model, '-i', prompt], {
    stdio: 'inherit',
  });
  if (result.status !== 0) throw new Error(`copilot exited with ${result.status ?? 'signal'}`);
  return { planned: false };
}

export function verifyAuth(repository) {
  const auth = spawnSync('gh', ['auth', 'status'], { stdio: 'ignore' });
  if (auth.status !== 0) throw new Error('run `gh auth login` in the host environment');
  const access = spawnSync('gh', ['api', `repos/${repository}`, '--jq', '.permissions.push'], { encoding: 'utf8' });
  if (access.status !== 0 || access.stdout.trim() !== 'true') throw new Error('push access could not be proven');
}
