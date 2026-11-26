#!/usr/bin/env node
import { additionalPrompt, launchCopilot, requireSquad2, loadConfig, resolveModel, resolveReviewBaseline, verifyAuth } from './heroes-flow-shared.mjs';
import { resolvePrompt } from './resolve-heroes-prompt.mjs';
const config = loadConfig();
requireSquad2();
verifyAuth(config.repository);
const argv = process.argv.slice(2);
const baseline = resolveReviewBaseline(config, argv);
const model = await resolveModel('review', argv);
const prompt = additionalPrompt(argv, resolvePrompt('review', config.language));
console.log(JSON.stringify({ flow: 'review', model, baseline, prompt }));
launchCopilot(model, prompt, argv);
