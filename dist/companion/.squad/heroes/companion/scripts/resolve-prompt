import { lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';

const names = { reqeng: 'startreqeng', work: 'startwork', review: 'startreview' };
const credentialPattern = new RegExp([
  `${['ghp', '_'].join('')}[A-Za-z0-9]{20,}`,
  `${['github', '_', 'pat_'].join('')}[A-Za-z0-9_]+`,
  '-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
].join('|'), 'u');

function regularUtf8(file) {
  const stat = lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 262_144) throw new Error(`invalid prompt file: ${file}`);
  const content = new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(file));
  if (credentialPattern.test(content)) {
    throw new Error(`prompt file contains a credential-shaped value: ${file}`);
  }
  return content;
}

export function resolvePrompt(flow, language) {
  const name = names[flow];
  if (!name || !['de', 'en'].includes(language)) throw new Error('invalid flow or language');
  const base = regularUtf8(path.resolve(`.github/prompts/${name}.prompt.md`));
  const manifest = JSON.parse(regularUtf8('.github/prompts/addon.config.json'));
  const layers = manifest.flows?.[flow];
  if (!Array.isArray(layers) || new Set(layers).size !== layers.length) throw new Error('invalid prompt layer manifest');
  for (const layer of layers) {
    if (!layer.startsWith('.github/prompts/') || path.isAbsolute(layer) || layer.split('/').includes('..')) {
      throw new Error(`unsafe prompt layer: ${layer}`);
    }
  }
  return [base, `LANGUAGE=${language}`, ...layers.map((layer) => regularUtf8(layer))].join('\n\n---\n\n');
}
