#!/usr/bin/env node
import { additionalPrompt, launchCopilot, requireSquad2, loadConfig, resolveModel, verifyAuth } from './heroes-flow-shared.mjs';
import { resolvePrompt } from './resolve-heroes-prompt.mjs';
requireSquad2();
const config = loadConfig();
verifyAuth(config.repository);
const argv = process.argv.slice(2);
const model = await resolveModel('work', argv);
const prompt = additionalPrompt(argv, resolvePrompt('work', config.language));
console.log(JSON.stringify({ flow: 'work', model, prompt }));
launchCopilot(model, prompt, argv);
