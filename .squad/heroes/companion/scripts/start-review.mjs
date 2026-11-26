#!/usr/bin/env node
import { composeFlowPrompt, launchCopilot, requireSquad2, loadConfig, resolveModel, resolveReviewBaseline, verifyAuth } from './heroes-flow-shared.mjs';
import { resolvePrompt } from './resolve-heroes-prompt.mjs';
const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) {
  console.log('Usage: start-review.mjs [--pr N] [--issue N] [--baseline SHA] [--model ID] [--prompt TEXT] [--noprompt|--plan]');
  process.exit(0);
}
const config = loadConfig();
requireSquad2();
verifyAuth(config.repository);
const baseline = resolveReviewBaseline(config, argv);
const model = await resolveModel('review', argv);
const prompt = composeFlowPrompt('review', resolvePrompt('review', config.language), argv, config, { baseline });
console.log(JSON.stringify({ flow: 'review', model, baseline, prompt }));
launchCopilot(model, prompt, argv);
