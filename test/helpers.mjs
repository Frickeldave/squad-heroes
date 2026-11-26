import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

let sequence = 0;
const ROOT = path.resolve(import.meta.dirname, '.workspaces');

export function fixture(version = '2.0.0') {
  const dir = path.join(ROOT, `${process.pid}-${sequence++}`);
  mkdirSync(path.join(dir, '.github/agents'), { recursive: true });
  writeFileSync(path.join(dir, '.github/agents/squad.agent.md'), `<!-- version: ${version} -->\n`);
  writeFileSync(path.join(dir, 'package.json'), `${JSON.stringify({ name: 'fixture', version: '1.0.0', type: 'module' }, null, 2)}\n`);
  mkdirSync(path.join(dir, 'src'), { recursive: true });
  writeFileSync(path.join(dir, 'src/index.ts'), 'export const fixture = true;\n');
  writeFileSync(path.join(dir, 'tsconfig.json'), `${JSON.stringify({ compilerOptions: { strict: true }, include: ['src'] }, null, 2)}\n`);
  return dir;
}

export function cleanup(dir) {
  rmSync(dir, { recursive: true, force: true });
}

export function write(root, file, content) {
  const target = path.join(root, file);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
}

export function commandResult(stdout = '') {
  return { status: 0, stdout, stderr: '' };
}
