#!/usr/bin/env node
import { resolve } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import {
  applyPlan,
  buildInstallPlan,
  machinePlan,
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
import { resolveLanguage, translate } from '../src/messages.mjs';
import { PROFILE_ID, PROFILE_NAME } from '../src/config.mjs';
import { createInterface } from 'node:readline/promises';
import { emitKeypressEvents } from 'node:readline';

function existingOptions(target) {
  const configPath = resolve(target ?? process.cwd(), '.squad/heroes.json');
  if (!existsSync(configPath)) return null;
  return JSON.parse(readFileSync(configPath, 'utf8'));
}

function wizardText(language, id) {
  return translate(language, id).text;
}

function localizedFailure(message) {
  const error = new Error(message);
  error.localized = true;
  return error;
}

export async function completeInteractiveOptions(options, existing, ask, choose, injected = {}) {
  const resolved = resolveLanguage(options.language, existing?.language, process.env);
  const language = resolved.language;
  if (!choose) throw localizedFailure(wizardText(language, 'menu_required'));
  options.language = language;
  const selectedProfile = await choose(
    wizardText(language, 'project_type_prompt'),
    [PROFILE_NAME],
    PROFILE_NAME
  );
  options.profile = selectedProfile;
  if (![PROFILE_ID, PROFILE_NAME].includes(options.profile)) {
    throw localizedFailure(wizardText(language, 'profile_only'));
  }
  if (options.profile === PROFILE_NAME) options.profile = PROFILE_ID;
  const authentication = assertGithubAuthentication({
    ...injected,
    language,
    repository: options.repository ?? existing?.repository,
    expectedAccount: options.expectedAccount ?? injected.expectedAccount,
  });
  options.repository ??= await ask(wizardText(language, 'repository_prompt'), existing?.repository ?? '');
  const repositoryAccess = preflightGithubAccess(options.repository, {
    ...injected,
    language,
    authentication,
    expectedAccount: options.expectedAccount ?? injected.expectedAccount,
  });
  options.githubPreflight = repositoryAccess;
  process.stdout.write(`${wizardText(language, 'github_access_verified')
    .replace('{account}', repositoryAccess.account)
    .replace('{owner}', repositoryAccess.owner)}\n`);

  if (!options.branches && !existing?.deploymentBranches) {
    const count = Number(await ask(wizardText(language, 'deployment_branch_count'), '1'));
    if (![1, 2, 3].includes(count)) throw localizedFailure(wizardText(language, 'deployment_branch_invalid'));
    options.branches = [];
    for (let index = 0; index < count; index += 1) {
      options.branches.push(await ask(
        translate(language, 'deployment_branch_prompt', { number: index + 1 }).text,
        index === 0 ? 'main' : ''
      ));
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
    wizardText(language, 'review_baseline_prompt'),
    existing?.reviewBaseline ?? ''
  ) || undefined;
  options.reviewBaseline = assertReviewBaseline(resolve(options.target ?? process.cwd()), options.reviewBaseline, injected);

  if (!options.boardSync && !options.boardSyncExplicit) {
    const current = existing?.extensions?.['board-sync'];
    const enable = (await ask(wizardText(language, 'board_sync_prompt'), current ? 'y' : 'N')).toLowerCase();
    options.boardSync = ['y', 'yes', 'j', 'ja'].includes(enable);
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
          throw localizedFailure(error?.localized
            ? `${manual}\n\n${error.message}`
            : manual);
        }
        if (selection !== createLabel) {
          throw localizedFailure(manual);
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
        if (!['y', 'yes', 'j', 'ja'].includes(String(ownerConfirmation).trim().toLowerCase())) {
          throw localizedFailure(wizardText(language, 'github_project_cancelled'));
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
    options.board.statusField ??= await ask(
      wizardText(language, 'project_status_field_prompt'),
      current?.statusField ?? 'Status'
    );
    options.board.statusMap ??= JSON.parse(await ask(
      wizardText(language, 'project_status_map_prompt'),
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
  if (values.length === 0) throw localizedFailure(translate(language, 'picker_no_choices', { label }).text);
  if (!supportsArrowKeyPicker({ input, output })) {
    throw localizedFailure(wizardText(language, 'picker_tty_required'));
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
          const marker = selected ? '>' : ' ';
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
        finish(null, localizedFailure(wizardText(language, 'picker_cancelled')));
      } else if (name === 'up' || name === 'k' || character === 'k') {
        selectedIndex = (selectedIndex - 1 + values.length) % values.length;
        render();
      } else if (name === 'down' || name === 'j' || character === 'j') {
        selectedIndex = (selectedIndex + 1) % values.length;
        render();
      } else if (name === 'return' || name === 'enter') {
        finish(values[selectedIndex]);
      } else if (key.ctrl && name === 'c') {
        finish(null, localizedFailure(wizardText(language, 'picker_cancelled')));
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

function linesAndBytes(value) {
  const text = String(value ?? '');
  return {
    lines: text === '' ? 0 : text.split(/\r?\n/u).length - (text.endsWith('\n') ? 1 : 0),
    bytes: Buffer.byteLength(text, 'utf8'),
  };
}

function naturalList(values, language) {
  if (values.length < 2) return values[0] ?? '';
  const conjunction = language === 'de' ? ' und ' : ' and ';
  return `${values.slice(0, -1).join(', ')}${conjunction}${values.at(-1)}`;
}

function managedBlock(source, section) {
  if (!section || !source) return '';
  const start = source.search(new RegExp(`<!--\\s*squad-heroes:${section}:begin(?:\\s+[^>]*)?\\s*-->`, 'u'));
  const endMarker = `<!-- squad-heroes:${section}:end -->`;
  const end = source.indexOf(endMarker, start);
  return start >= 0 && end >= start ? source.slice(start, end + endMarker.length) : '';
}

function incomingTableNames(source) {
  return String(source ?? '').split(/\r?\n/u)
    .map((line) => line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/u))
    .filter((match) => match && !['Name', 'Domain', '---'].includes(match[1]))
    .map((match) => match[1]);
}

function conflictExplanation(conflict, language) {
  const missing = !managedBlock(conflict.before, conflict.section);
  const values = { target: conflict.target };
  if (conflict.target === '.squad/team.md' && missing) {
    const agents = incomingTableNames(managedBlock(conflict.incoming, conflict.section));
    return [
      translate(language, 'conflict_team_missing', values).text,
      translate(language, 'conflict_team_plan', {
        agents: naturalList(agents, language),
      }).text,
    ];
  }
  if (conflict.target === '.squad/routing.md' && missing) {
    const rows = incomingTableNames(managedBlock(conflict.incoming, conflict.section));
    return [
      translate(language, 'conflict_routing_missing', values).text,
      translate(language, 'conflict_routing_plan', { count: rows.length }).text,
    ];
  }
  if (conflict.mode === 'package-json') {
    return [
      translate(language, 'conflict_package', values).text,
      translate(language, 'conflict_package_plan').text,
    ];
  }
  if (conflict.mode === 'whole-file') {
    return [
      translate(language, 'conflict_whole_file', values).text,
      translate(language, 'conflict_whole_file_plan').text,
    ];
  }
  return missing
    ? [
        translate(language, 'conflict_managed_missing', values).text,
        translate(language, 'conflict_managed_plan').text,
      ]
    : [
        translate(language, 'conflict_managed_changed', values).text,
        translate(language, 'conflict_managed_changed_plan').text,
      ];
}

function choiceLabels(conflict, language) {
  const labels = new Map([
    ['merge', translate(language, 'conflict_choice_merge').text],
    ['use', translate(language, conflict.mode === 'whole-file'
      ? 'conflict_choice_use_file'
      : 'conflict_choice_use').text],
    ['keep', translate(language, 'conflict_choice_keep').text],
    ['abort', translate(language, 'conflict_choice_abort').text],
  ]);
  const order = ['merge', 'use', 'keep', 'abort'].filter((value) =>
    conflict.options.includes(value));
  return {
    order,
    labels,
    choices: order.map((value) => labels.get(value)),
  };
}

function printConflictDetails(conflict, language, output) {
  const base = linesAndBytes(conflict.base);
  const local = linesAndBytes(conflict.before);
  const incoming = linesAndBytes(conflict.incoming);
  output.write(`${translate(language, 'conflict_details_heading').text}\n`);
  output.write(`${translate(language, 'conflict_details_three_way', {
    baseLines: base.lines,
    baseBytes: base.bytes,
    localLines: local.lines,
    localBytes: local.bytes,
    incomingLines: incoming.lines,
    incomingBytes: incoming.bytes,
  }).text}\n`);
  const block = managedBlock(conflict.incoming, conflict.section);
  if (!block) return;
  const size = linesAndBytes(block);
  output.write(`${translate(language, 'conflict_details_section', {
    lines: size.lines,
    bytes: size.bytes,
  }).text}\n`);
  const preview = block.split(/\r?\n/u).slice(0, 12).map((line) =>
    line.length > 240 ? `${line.slice(0, 237)}...` : line
  );
  output.write(`${translate(language, 'conflict_details_preview', { lines: preview.length }).text}\n`);
  output.write(preview.map((line) => `  ${line}`).join('\n') + '\n');
}

export async function resolveConflictDecisions(plan, choose, { language = 'en', output = process.stdout } = {}) {
  const decisions = { ...(plan.config.recovery?.decisions ?? {}) };
  for (const conflict of plan.conflicts) {
    output.write(`${conflictExplanation(conflict, language).join('\n')}\n`);
    const recommended = conflict.recommendation ?? 'merge';
    if (recommended === 'merge' && !managedBlock(conflict.before, conflict.section)) {
      // The recommendation is included in the concise explanation below.
    }
    const { order, labels, choices } = choiceLabels(conflict, language);
    const recommendation = labels.get(recommended);
    if (!recommendation) throw localizedFailure(wizardText(language, 'conflict_invalid_recommendation'));
    const details = translate(language, 'conflict_choice_details').text;
    let selected;
    while (true) {
      const available = [...choices, details];
      const current = labels.get(recommended) ?? choices[0];
      const selection = await choose(
        wizardText(language, 'conflict_picker_label').replace('{target}', conflict.target),
        available,
        current
      );
      if (selection === details) {
        printConflictDetails(conflict, language, output);
        continue;
      }
      selected = order.find((value) => labels.get(value) === selection || value === selection);
      if (selected) break;
      throw localizedFailure(translate(language, 'conflict_invalid_selection', {
        selection,
        target: conflict.target,
      }).text);
    }
    decisions[conflict.target] = selected;
    output.write(`${translate(language, 'conflict_decided', {
      target: conflict.target,
      decision: translate(language, `conflict_decision_${selected}`).text,
      effect: translate(language, `conflict_effect_${selected}`).text,
    }).text}\n`);
  }
  return decisions;
}

async function wizard(options) {
  const existing = existingOptions(options.target);
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (label, fallback = '') => {
    const suffix = fallback ? ` [${fallback}]` : '';
    return (await prompt.question(`${label}${suffix}: `)).trim() || fallback;
  };
  const choose = async (label, choices, current = '') => {
    const language = resolveLanguage(options.language, existing?.language, process.env).language;
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
      const existing = existingOptions(options.target);
      const language = resolveLanguage(options.language, existing?.language, process.env).language;
      process.stdout.write(`${translate(language, 'help_text').text}\n`);
      return;
    }
    if (supportsArrowKeyPicker()) {
      await wizard(options);
    } else {
      const existing = existingOptions(options.target);
      const language = resolveLanguage(options.language, existing?.language, process.env).language;
      options.language = language;
      const authentication = assertGithubAuthentication({
        language,
        repository: options.repository ?? existing?.repository,
        expectedAccount: options.expectedAccount,
      });
      const accessRepository = options.repository ?? existing?.repository;
      if (!accessRepository) {
        throw localizedFailure(wizardText(language, 'repository_required'));
      }
      options.githubPreflight = preflightGithubAccess(accessRepository, {
        language,
        authentication,
        expectedAccount: options.expectedAccount,
      });
      if (!options.jsonPlan) {
        process.stdout.write(`${wizardText(language, 'github_access_verified')
          .replace('{account}', options.githubPreflight.account)
          .replace('{owner}', options.githubPreflight.owner)}\n`);
      }
      assertSquadCompatibility(resolve(options.target ?? process.cwd()), { language });
      const missingModelFlags = !existing && ['reqeng', 'work', 'review']
        .some((flow) => !options.explicitModels[flow]);
      if (missingModelFlags) {
        throw localizedFailure(wizardText(language, 'picker_tty_required'));
      }
      if (!existing && options.profile !== PROFILE_ID) {
        throw localizedFailure(wizardText(language, 'project_type_required'));
      }
    }
    const repoRoot = resolve(options.target ?? process.cwd());
    let plan = buildInstallPlan(repoRoot, options, {
      githubPreflight: options.githubPreflight,
    });
    if (options.jsonPlan) {
      process.stdout.write(`${JSON.stringify(machinePlan(plan), null, 2)}\n`);
    } else {
      printPlan(plan, plan.config.language, { dryRun: options.dryRun });
    }
    if (options.planJsonPath) {
      writeFileSync(resolve(options.planJsonPath), `${JSON.stringify(machinePlan(plan), null, 2)}\n`, {
        encoding: 'utf8',
        mode: 0o600,
      });
    }
    if (options.jsonPlan) return;
    let resolvedConflicts = false;
    if (plan.conflicts.length > 0 && supportsArrowKeyPicker()) {
      const decisions = await resolveConflictDecisions(plan, (label, choices, current) =>
        selectWithArrowKeys(label, choices, current, { language: plan.config.language })
      );
      options.decisions = decisions;
      plan = buildInstallPlan(repoRoot, options, {
        githubPreflight: options.githubPreflight,
      });
      resolvedConflicts = true;
    }
    if (resolvedConflicts && plan.conflicts.length > 0) {
      throw localizedFailure(translate(plan.config.language, 'resolved_plan_conflicts', {
        count: plan.conflicts.length,
      }).text);
    }
    if (resolvedConflicts && !options.dryRun) {
      const prompt = createInterface({ input: process.stdin, output: process.stdout });
      try {
        const approval = (await prompt.question(`${wizardText(
          plan.config.language,
          'resolved_apply_approval'
        )}: `)).trim().toLowerCase();
        if (!['y', 'yes', 'j', 'ja'].includes(approval)) {
          throw localizedFailure(wizardText(plan.config.language, 'resolved_plan_not_approved'));
        }
      } finally {
        prompt.close();
      }
    }
    if (plan.projectCreate && options.renderedProjectApprovalRequired && !options.dryRun) {
      const prompt = createInterface({ input: process.stdin, output: process.stdout });
      try {
        const approval = (await prompt.question(
          wizardText(plan.config.language, 'github_project_apply_approval')
            .replace('{owner}', plan.projectCreate.owner)
            .replace('{title}', plan.projectCreate.title) + ': '
        )).trim().toLowerCase();
        if (!['y', 'yes', 'j', 'ja'].includes(approval)) {
          throw localizedFailure(wizardText(plan.config.language, 'github_project_cancelled'));
        }
        plan.projectCreate.approved = true;
      } finally {
        prompt.close();
      }
    }
    const result = applyPlan(repoRoot, plan, options);
    if (!options.jsonPlan && !options.dryRun) {
      const message = translate(plan.config.language, 'apply_complete_result', { count: result.changed }).text;
      process.stdout.write(`${message}\n`);
    }
  } catch (error) {
    let message = error instanceof Error ? error.message : String(error);
    let language = null;
    let parsed = null;
    try {
      parsed = parseInstallArguments(process.argv.slice(2));
    } catch {
      parsed = {
        language: process.argv.includes('--language')
          ? process.argv[process.argv.indexOf('--language') + 1]
          : null,
        target: process.argv.includes('--target')
          ? process.argv[process.argv.indexOf('--target') + 1]
          : undefined,
      };
    }
    try {
      let existing = null;
      try {
        existing = existingOptions(parsed.target);
      } catch {
        // Keep the raw parse failure out of the user-facing diagnostic.
      }
      language = resolveLanguage(parsed.language, existing?.language, process.env).language;
    } catch {
      // An invalid or missing language decision is itself the actionable error.
    }
    if (
      language &&
      !(error instanceof HeroesError && error.details?.localized === true) &&
      !error?.localized &&
      !/^Unsupported installer language|^Ambiguous installer language|^Installer language/u.test(message)
    ) {
      message = translate(language, 'install_failed', {
        category: error instanceof HeroesError ? error.code : 'unerwartet',
      }).text;
    }
    process.stderr.write(`${message}\n`);
    process.exitCode = error instanceof HeroesError && error.code === 'squad_version'
      ? INCOMPATIBLE_SQUAD_EXIT
      : 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
