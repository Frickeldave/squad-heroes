#!/usr/bin/env node
import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import {
  applyPlan,
  buildInstallPlan,
  parseInstallArguments,
  printPlan,
  projectManualInstructions,
} from '../src/installer.mjs';
import { HeroesError, INCOMPATIBLE_SQUAD_EXIT } from '../src/errors.mjs';
import {
  assertGithubAuthentication,
  assertSquadCompatibility,
  assertReviewBaseline,
  discoverModels,
  preflightGithubAccess,
  resolveBoardProject,
} from '../src/preflight.mjs';
import { resolveLanguage, supportedLanguage, translate } from '../src/messages.mjs';
import { createInterface } from 'node:readline/promises';
import { emitKeypressEvents } from 'node:readline';

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

Interactive model and Project selection use an in-place arrow-key picker
(Up/Down or j/k, Enter, Escape/q). CI must supply noninteractive flags, including
--model-reqeng/--model-work/--model-review. The runtime --model override remains
available.

With --enable-board-sync, Project owner is derived from --repository. The
write-capable project scope is proved from the active account's sanitized
gh auth status output. Owner type from gh project output is reused when present;
otherwise a non-mutating identity query resolves User versus Organization before
the Project API probe. CI may use
--project-number for a deterministic validated override. Use --disable-board-sync
to make the board-off choice explicit without a prompt. When no Project exists,
interactive use offers explicit Companion creation or cancellation. CI must use
both --create-project and --project-title; the former is the explicit apply
approval and never accepts a boolean value. The rendered dry-run contains a
Project-number placeholder and every follow-up schema/link operation, and makes
no external mutation. A separate "create manually" choice and cancellation both
print concrete recovery steps; apply failures report possible partial external
state and never disclose secrets. The scope and API gates remain required for
dry-run. No token is accepted.
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
  const preliminaryLanguage = supportedLanguage(
    options.language ?? existing?.language ?? process.env.LANG
  ) ?? 'en';
  const authentication = assertGithubAuthentication({
    ...injected,
    language: preliminaryLanguage,
    repository: options.repository ?? existing?.repository,
    expectedAccount: options.expectedAccount ?? injected.expectedAccount,
  });
  options.repository ??= await ask('GitHub repository (owner/name)', existing?.repository ?? '');
  const repositoryAccess = preflightGithubAccess(options.repository, {
    ...injected,
    language: preliminaryLanguage,
    authentication,
    expectedAccount: options.expectedAccount ?? injected.expectedAccount,
  });
  options.githubPreflight = repositoryAccess;
  process.stdout.write(`${wizardText(preliminaryLanguage, 'github_access_verified')
    .replace('{account}', repositoryAccess.account)
    .replace('{owner}', repositoryAccess.owner)}\n`);

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

  if (!options.boardSync && !options.boardSyncExplicit) {
    const current = existing?.extensions?.['board-sync'];
    const enable = (await ask('Enable optional Project board sync (y/N)', current ? 'y' : 'N')).toLowerCase();
    options.boardSync = ['y', 'yes'].includes(enable);
    options.boardSyncExplicit = true;
  }
  if (options.boardSync) {
    const current = existing?.extensions?.['board-sync'];
    const configuredNumber = options.board.number ?? current?.number;
    if (configuredNumber === undefined || configuredNumber === null || configuredNumber === '') {
      const projects = repositoryAccess.projects;
      if (projects.length === 0) {
        const createLabel = wizardText(language, 'github_project_create');
        const manualLabel = wizardText(language, 'github_project_manual');
        const cancelLabel = wizardText(language, 'github_project_cancel');
        const defaultTitle = options.repository.split('/')[1];
        const manual = `${wizardText(language, 'github_project_cancelled')}\n\n` +
          projectManualInstructions(language, {
            owner: repositoryAccess.owner,
            title: options.projectTitle ?? defaultTitle,
            active: repositoryAccess.account,
          });
        let selection;
        try {
          selection = await choose(
            wizardText(language, 'github_project_missing'),
            [createLabel, manualLabel, cancelLabel],
            createLabel
          );
        } catch (error) {
          throw new Error(`${manual}\n\n${error instanceof Error ? error.message : String(error)}`);
        }
        if (selection !== createLabel) {
          throw new Error(manual);
        }
        options.projectTitle = await ask(
          wizardText(language, 'github_project_title_prompt'),
          options.projectTitle ?? defaultTitle
        );
        const ownerConfirmation = await ask(
          wizardText(language, 'github_project_owner_prompt')
            .replace('{owner}', repositoryAccess.owner)
            .replace('{account}', repositoryAccess.account)
            .replace('{title}', options.projectTitle),
          'N'
        );
        if (!['y', 'yes'].includes(String(ownerConfirmation).trim().toLowerCase())) {
          throw new Error(wizardText(language, 'github_project_cancelled'));
        }
        options.createProject = true;
        options.createProjectApproved = false;
        options.renderedProjectApprovalRequired = true;
      } else if (projects.length > 1) {
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
    if (!options.createProject) {
      resolveBoardProject(options.repository, options.board, {
        ...injected,
        configuredNumber: current?.number,
        language,
        account: repositoryAccess.account,
        projectCatalog: repositoryAccess.projects,
      });
    }
    options.board.statusField ??= await ask('Project status field', current?.statusField ?? 'Status');
    options.board.statusMap ??= JSON.parse(await ask(
      'Project status map JSON',
      JSON.stringify(current?.statusMap ?? { 'go:yes': 'Ready', 'go:done': 'Done' })
    ));
    // Project V2 is outside the repository-scoped GITHUB_TOKEN permission model.
    // A separately maintained Actions secret is wired by the workflow, not the
    // installer plan, so no token expression or value enters local state.
  }
  return options;
}

export function supportsArrowKeyPicker({ input = process.stdin, output = process.stdout } = {}) {
  return Boolean(
    input.isTTY &&
    output.isTTY &&
    typeof input.setRawMode === 'function'
  );
}

/**
 * Select one value with terminal keypresses. This intentionally has no
 * numeric-entry fallback: non-TTY automation must provide CLI flags.
 */
export function selectWithArrowKeys(label, choices, current = '', options = {}) {
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;
  const language = options.language ?? 'en';
  const emitKeypressEventsFn = options.emitKeypressEventsFn ?? emitKeypressEvents;
  const values = [...new Set(choices.filter(Boolean))];
  if (current && !values.includes(current)) values.unshift(current);
  if (values.length === 0) throw new Error(`No choices are available for ${label}`);
  if (!supportsArrowKeyPicker({ input, output })) {
    throw new Error(wizardText(language, 'picker_tty_required'));
  }

  const currentIndex = values.indexOf(current);
  let selectedIndex = currentIndex >= 0 ? currentIndex : 0;
  let cleanedUp = false;
  let renderedLines = 0;
  let rawModeBefore = Boolean(input.isRaw);
  const help = wizardText(language, 'picker_help');
  const currentSuffix = wizardText(language, 'picker_current');

  return new Promise((resolvePromise, rejectPromise) => {
    const render = () => {
      const lines = [
        label,
        help,
        ...values.map((value, index) => {
          const selected = index === selectedIndex;
          const marker = selected ? '❯' : ' ';
          const currentText = value === current ? ` ${currentSuffix}` : '';
          const line = `${marker} ${value}${currentText}`;
          return selected ? `\x1B[7m${line}\x1B[0m` : line;
        }),
      ];
      if (renderedLines > 0) {
        output.write(`\r\x1B[${renderedLines}A\x1B[0J`);
      }
      output.write(`${lines.join('\n')}\n`);
      renderedLines = lines.length;
    };

    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      input.off('keypress', handleKeypress);
      if (renderedLines > 0) output.write(`\r\x1B[${renderedLines}A\x1B[0J`);
      input.setRawMode(rawModeBefore);
      output.write('\x1B[?25h');
    };

    const finish = (value, error) => {
      cleanup();
      if (error) rejectPromise(error);
      else {
        output.write(`${label}: ${value}\n`);
        resolvePromise(value);
      }
    };

    const handleKeypress = (value, key = {}) => {
      const name = String(key.name ?? '').toLowerCase();
      const character = String(value ?? '').toLowerCase();
      if (name === 'escape' || name === 'q' || character === 'q') {
        finish(null, new Error(wizardText(language, 'picker_cancelled')));
      } else if (name === 'up' || name === 'k' || character === 'k') {
        selectedIndex = (selectedIndex - 1 + values.length) % values.length;
        render();
      } else if (name === 'down' || name === 'j' || character === 'j') {
        selectedIndex = (selectedIndex + 1) % values.length;
        render();
      } else if (name === 'return' || name === 'enter') {
        finish(values[selectedIndex]);
      } else if (key.ctrl && name === 'c') {
        finish(null, new Error(wizardText(language, 'picker_cancelled')));
      }
      // Digits and other printable characters are deliberately ignored.
    };

    try {
      emitKeypressEventsFn(input);
      input.on('keypress', handleKeypress);
      input.setRawMode(true);
      input.resume();
      output.write('\x1B[?25l');
      render();
    } catch (error) {
      cleanup();
      rejectPromise(error);
    }
  });
}

async function wizard(options) {
  const existing = existingOptions(options.target);
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (label, fallback = '') => {
    const suffix = fallback ? ` [${fallback}]` : '';
    return (await prompt.question(`${label}${suffix}: `)).trim() || fallback;
  };
  const choose = async (label, choices, current = '') => {
    const language = supportedLanguage(options.language ?? existing?.language ?? process.env.LANG) ?? 'en';
    prompt.pause();
    try {
      return await selectWithArrowKeys(label, choices, current, { language });
    } finally {
      prompt.resume();
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
    if (supportsArrowKeyPicker()) {
      await wizard(options);
    } else {
      const existing = existingOptions(options.target);
      const language = supportedLanguage(options.language ?? process.env.LANG) ?? 'en';
      const authentication = assertGithubAuthentication({
        language,
        repository: options.repository ?? existing?.repository,
        expectedAccount: options.expectedAccount,
      });
      const accessRepository = options.repository ?? existing?.repository;
      if (!accessRepository) {
        throw new Error('--repository owner/name is required for noninteractive installation.');
      }
      options.githubPreflight = preflightGithubAccess(accessRepository, {
        language,
        authentication,
        expectedAccount: options.expectedAccount,
      });
      process.stdout.write(`${wizardText(language, 'github_access_verified')
        .replace('{account}', options.githubPreflight.account)
        .replace('{owner}', options.githubPreflight.owner)}\n`);
      assertSquadCompatibility(resolve(options.target ?? process.cwd()));
      const missingModelFlags = !existing && ['reqeng', 'work', 'review']
        .some((flow) => !options.explicitModels[flow]);
      if (missingModelFlags) {
        throw new Error(wizardText(language, 'picker_tty_required'));
      }
    }
    const repoRoot = resolve(options.target ?? process.cwd());
    const plan = buildInstallPlan(repoRoot, options, {
      githubPreflight: options.githubPreflight,
    });
    printPlan(plan, plan.config.language);
    if (plan.projectCreate && options.renderedProjectApprovalRequired && !options.dryRun) {
      const prompt = createInterface({ input: process.stdin, output: process.stdout });
      try {
        const approval = (await prompt.question(
          wizardText(plan.config.language, 'github_project_apply_approval')
            .replace('{owner}', plan.projectCreate.owner)
            .replace('{title}', plan.projectCreate.title) + ' (y/N): '
        )).trim().toLowerCase();
        if (!['y', 'yes'].includes(approval)) {
          throw new Error(wizardText(plan.config.language, 'github_project_cancelled'));
        }
        plan.projectCreate.approved = true;
      } finally {
        prompt.close();
      }
    }
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
