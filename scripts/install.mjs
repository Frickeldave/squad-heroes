#!/usr/bin/env node
import { resolve } from 'node:path';
import { applyPlan, buildInstallPlan, parseInstallArguments, printPlan } from '../src/installer.mjs';
import { HeroesError, INCOMPATIBLE_SQUAD_EXIT } from '../src/errors.mjs';
import { createInterface } from 'node:readline/promises';

const HELP = `Usage:
  node scripts/install.mjs --target /path/to/repository --repository owner/name --deployment-branches N \\
    --deployment-branch-1 main [--deployment-branch-2 int ...] [--language de|en] [--dry-run]

Squad 2.0.0 or higher must be installed in the target repository. The installer
is human-triggered, performs two version checks, never calls plugin installation
as a substitute for companion materialization, and does not ask for credentials.

Model selection is --model-reqeng/--model-work/--model-review or the persisted
flow defaults in .squad/heroes.json; there is no fallback.
`;

export async function main() {
  try {
    const options = parseInstallArguments(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(HELP);
      return;
    }
    if (!options.profile) {
      if (!process.stdin.isTTY) {
        throw new Error('Non-interactive installation requires --profile typescript-development');
      }
      const prompt = createInterface({ input: process.stdin, output: process.stdout });
      try {
        options.profile = (await prompt.question('Project profile (TypeScript Development): ')).trim() || 'typescript-development';
      } finally {
        prompt.close();
      }
      if (!['typescript-development', 'TypeScript Development'].includes(options.profile)) {
        throw new Error('Only TypeScript Development is available in this MVP');
      }
      if (options.profile === 'TypeScript Development') options.profile = 'typescript-development';
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
