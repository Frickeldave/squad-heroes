#!/usr/bin/env node
import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { applyPlan, buildInstallPlan, parseInstallArguments, printPlan } from '../src/installer.mjs';
import { HeroesError, INCOMPATIBLE_SQUAD_EXIT } from '../src/errors.mjs';
import {
  assertGithubWriteAccess,
  assertReviewBaseline,
  discoverModels,
  listBoardProjects,
  resolveBoardProject,
} from '../src/preflight.mjs';
import { resolveLanguage, supportedLanguage, translate } from '../src/messages.mjs';
import { createInterface } from 'node:readline/promises';

const HELP = `Usage:
  node .squad/templates/squad-heroes/companion/scripts/install --target /path/to/repository --repository owner/name --profile typescript-development --deployment-branches N \\
    --deployment-branch-1 main [--deployment-branch-2 int ...] [--language de|en] [--expected-github-account ACCOUNT] [--dry-run]

Squad 2.0.0 or higher must be installed in the target repository. The installer
is human-triggered, performs two version checks, never calls plugin installation
as a substitute for companion materialization, and does not ask for credentials.

This is the Companion plan for active scripts, prompts, workflows, and agent
targets. \`squad plugin dry-run <squad-heroes-dir>\` is a separate Squad lifecycle
command that lists the complete versioned Companion distribution below
templates/squad-heroes/companion/. It does not directly target active consumer
paths.

Interactive model selection is a menu, backed by the installed Copilot model
catalog or a visible verified fallback. CI may override a flow at launch with
--model; installation flags --model-reqeng/--model-work/--model-review remain
available.

With --enable-board-sync, Project owner is derived from --repository. Project
number is discovered and validated read-only; CI may use --project-number for a
deterministic validated override. No token is accepted.
`;

function existingOptions(target) {
  const configPath = resolve(target ?? process.cwd(), '.squad/heroes.json');
  if (!existsSync(configPath)) return null;
  return JSON.parse(readFileSync(configPath, 'utf8'));
}

function wizardText(language, id) {
  return translate(language, id).text;
}

export async function completeInteractiveOptions(options, existing, ask, choose, injected = {}) {
  if (!choose) throw new Error('Interactive selection requires a menu implementation');
  options.repository ??= await ask('GitHub repository (owner/name)', existing?.repository ?? '');
  const preliminaryLanguage = supportedLanguage(
    options.language ?? existing?.language ?? process.env.LANG
  ) ?? 'en';
  const repositoryAccess = assertGithubWriteAccess(options.repository, {
    ...injected,
    language: preliminaryLanguage,
    expectedAccount: options.expectedAccount ?? injected.expectedAccount,
  });
  process.stdout.write(`${wizardText(preliminaryLanguage, 'github_access_verified').replace('{account}', repositoryAccess.account)}\n`);

  options.profile ??= await ask('Project profile', existing?.profile ?? 'typescript-development');
  if (!['typescript-development', 'TypeScript Development'].includes(options.profile)) {
    throw new Error('Only TypeScript Development is available in this MVP');
  }
  if (options.profile === 'TypeScript Development') options.profile = 'typescript-development';
  options.language ??= await ask('Language (de|en)', existing?.language ?? 'en');
  const language = resolveLanguage(options.language, existing?.language, process.env.LANG).language;

  if (!options.branches && !existing?.deploymentBranches) {
    const count = Number(await ask('Deployment branch count (1-3)', '1'));
    if (![1, 2, 3].includes(count)) throw new Error('Deployment branch count must be 1, 2 or 3');
    options.branches = [];
    for (let index = 0; index < count; index += 1) {
      options.branches.push(await ask(`Deployment branch ${index + 1}`, index === 0 ? 'main' : ''));
    }
  }

  const discovery = discoverModels(injected);
  if (discovery.fallback) process.stdout.write(`${wizardText(language, 'model_catalog_fallback')}\n`);
  for (const flow of ['reqeng', 'work', 'review']) {
    if (!options.explicitModels?.[flow]) {
      const fallback = existing?.modelDefaults?.[flow] ?? options.models[flow];
      const label = wizardText(language, `default_model_${flow}`);
      options.models[flow] = await choose(label, discovery.models, fallback);
      options.explicitModels[flow] = true;
    }
  }
  options.reviewBaseline ??= await ask(
    'Review baseline commit (optional; blank keeps the configured value)',
    existing?.reviewBaseline ?? ''
  ) || undefined;
  options.reviewBaseline = assertReviewBaseline(resolve(options.target ?? process.cwd()), options.reviewBaseline, injected);

  if (!options.boardSync) {
    const current = existing?.extensions?.['board-sync'];
    const enable = (await ask('Enable optional Project board sync (y/N)', current ? 'y' : 'N')).toLowerCase();
    options.boardSync = ['y', 'yes'].includes(enable);
  }
  if (options.boardSync) {
    const current = existing?.extensions?.['board-sync'];
    const configuredNumber = options.board.number ?? current?.number;
    if (configuredNumber === undefined || configuredNumber === null || configuredNumber === '') {
      const projects = listBoardProjects(options.repository, {
        ...injected,
        language,
        account: repositoryAccess.account,
      });
      if (projects.length > 1) {
        const labels = projects.map((project) =>
          `${project.number} — ${project.title ?? project.name ?? 'Project'}`
        );
        const selection = await choose(
        wizardText(language, 'github_project'),
        labels,
        labels[projects.findIndex(({ number }) => Number(number) === Number(current?.number))] ?? labels[0]
        );
        options.board.number = Number(String(selection).split(/\s+—\s+/u, 1)[0]);
      }
    }
    resolveBoardProject(options.repository, options.board, {
      ...injected,
      configuredNumber: current?.number,
      language,
      account: repositoryAccess.account,
    });
    options.board.statusField ??= await ask('Project status field', current?.statusField ?? 'Status');
    options.board.statusMap ??= JSON.parse(await ask(
      'Project status map JSON',
      JSON.stringify(current?.statusMap ?? { 'go:yes': 'Ready', 'go:done': 'Done' })
    ));
    options.board.secret ??= await ask(
      'GitHub Actions secret expression',
      current?.secret ?? 'secrets.HEROES_PROJECT_TOKEN'
    );
  }
  return options;
}

async function wizard(options) {
  const existing = existingOptions(options.target);
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (label, fallback = '') => {
    const suffix = fallback ? ` [${fallback}]` : '';
    return (await prompt.question(`${label}${suffix}: `)).trim() || fallback;
  };
  const choose = async (label, choices, current = '') => {
    const values = [...new Set(choices.filter(Boolean))];
    if (current && !values.includes(current)) values.unshift(current);
    if (values.length === 0) throw new Error(`No choices are available for ${label}`);
    process.stdout.write(`${label} (choose one):\n`);
    values.forEach((choice, index) => {
      process.stdout.write(`  ${index + 1}. ${choice}${choice === current ? ' (current)' : ''}\n`);
    });
    while (true) {
      const answer = (await prompt.question(`Select 1-${values.length}${current ? ` [${values.indexOf(current) + 1}]` : ''}: `)).trim();
      const index = Number(answer || (current ? values.indexOf(current) + 1 : NaN)) - 1;
      if (Number.isInteger(index) && index >= 0 && index < values.length) return values[index];
      process.stdout.write('Invalid selection. Choose a displayed menu number.\n');
    }
  };
  try {
    return await completeInteractiveOptions(options, existing, ask, choose);
  } finally {
    prompt.close();
  }
}

export async function main() {
  try {
    const options = parseInstallArguments(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(HELP);
      return;
    }
    if (process.stdin.isTTY) {
      await wizard(options);
    } else if (options.repository) {
      const language = supportedLanguage(options.language ?? process.env.LANG) ?? 'en';
      const access = assertGithubWriteAccess(options.repository, {
        language,
        expectedAccount: options.expectedAccount,
      });
      if (options.boardSync) resolveBoardProject(options.repository, options.board, {
        language,
        account: access.account,
      });
    }
    const repoRoot = resolve(options.target ?? process.cwd());
    const plan = buildInstallPlan(repoRoot, options);
    printPlan(plan, plan.config.language);
    const result = applyPlan(repoRoot, plan, options);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = error instanceof HeroesError && error.code === 'squad_version'
      ? INCOMPATIBLE_SQUAD_EXIT
      : 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
