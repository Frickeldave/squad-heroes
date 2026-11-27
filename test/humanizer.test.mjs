import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { applyPlan, buildInstallPlan } from '../src/installer.mjs';
import { cleanup, commandResult, fixture } from './helpers.mjs';

const root = path.resolve(import.meta.dirname, '..');
const skillRoot = path.join(root, '.squad/heroes/skills/humanizer');
const injected = {
  cwd: '.',
  spawn: (command, args) => {
    if (args[0] === 'api' && args[1] === 'user') return commandResult('octocat\n');
    if (args[0] === 'api' && args[1].startsWith('repos/')) {
      return commandResult('{"pull":true,"push":true,"admin":false,"triage":false}\n');
    }
    if (args[0] === 'project' && args[1] === 'list') return commandResult('{"projects":[]}\n');
    return commandResult();
  },
};

const files = ['SKILL.md', 'de-DE.md', 'en-US.md'];

function json(file) {
  return JSON.parse(readFileSync(path.join(root, file), 'utf8'));
}

test('Humanizer has a shared router and both localized rule sets in every distribution', () => {
  for (const file of files) assert.equal(existsSync(path.join(skillRoot, file)), true, file);

  const sourcePaths = files.map((file) => `.squad/heroes/skills/humanizer/${file}`);
  const manifest = json('.squad/heroes/manifest.json');
  const marketplace = json('plugin.manifest.json');
  const targets = json('.squad/heroes/companion-targets.json').targets;
  for (const source of sourcePaths) {
    assert.ok(manifest.files.some((file) => file.source === source), source);
    const distributed = `dist/companion/${source}`;
    assert.ok(marketplace.files.some((file) =>
      file.source === distributed &&
      file.target === `templates/squad-heroes/companion/${source}`
    ), source);
  }
  for (const file of files) {
    assert.ok(targets.some((entry) =>
      entry.source === `.squad/heroes/skills/humanizer/${file}` &&
      entry.target === `.github/skills/humanizer/${file}` &&
      entry.mode === 'whole-file'
    ), file);
  }
});

test('the TypeScript profile registers Humanizer', () => {
  const profile = json('.squad/heroes/profiles/typescript-development.json');
  assert.deepEqual(profile.skills, ['humanizer']);
});

test('clean installation places all Humanizer files under .github/skills', () => {
  const repo = fixture();
  try {
    const plan = buildInstallPlan(repo, {
      repository: 'owner/repository',
      profile: 'typescript-development',
      language: 'en',
      locale: 'en_US',
      branches: ['main'],
      models: { reqeng: 'mai-code-2', work: 'claude-sonnet-5.5', review: 'gpt-6.1-terra' },
      boardSync: false,
    }, injected);
    applyPlan(repo, plan, {}, injected);
    for (const file of files) {
      const installed = path.join(repo, '.github/skills/humanizer', file);
      assert.equal(existsSync(installed), true, file);
      assert.equal(readFileSync(installed, 'utf8'), readFileSync(path.join(skillRoot, file), 'utf8'));
    }
    const german = readFileSync(path.join(repo, '.squad/agents/maria/charter.de.md'), 'utf8');
    const english = readFileSync(path.join(repo, '.squad/agents/maria/charter.en.md'), 'utf8');
    const selected = readFileSync(path.join(repo, '.squad/agents/maria/charter.md'), 'utf8');
    assert.match(german, /humanizer\/de-DE\.md/u);
    assert.match(english, /humanizer\/en-US\.md/u);
    assert.match(selected, /humanizer\/en-US\.md/u);
    assert.doesNotMatch(selected, /humanizer\/de-DE\.md/u);
  } finally {
    cleanup(repo);
  }
});

test('localized agent charters select exactly the matching prose rules', () => {
  const agents = path.join(root, '.squad/heroes/agents');
  for (const file of readdirSync(agents).filter((name) => name.endsWith('.md'))) {
    const source = readFileSync(path.join(agents, file), 'utf8');
    if (file.endsWith('.de.md')) {
      assert.match(source, /\.github\/skills\/humanizer\/de-DE\.md/u, file);
      assert.doesNotMatch(source, /humanizer\/en-US\.md/u, file);
    } else if (file.endsWith('.en.md')) {
      assert.match(source, /\.github\/skills\/humanizer\/en-US\.md/u, file);
      assert.doesNotMatch(source, /humanizer\/de-DE\.md/u, file);
    } else {
      assert.fail(`unexpected agent language: ${file}`);
    }
    assert.match(source, /code-only|reine(?:n)? Code-Ausgaben/u, file);
  }
});

test('Maria makes Humanizer mandatory for every localized documentation deliverable and prose review', () => {
  const de = readFileSync(path.join(root, '.squad/heroes/agents/maria.de.md'), 'utf8');
  const en = readFileSync(path.join(root, '.squad/heroes/agents/maria.en.md'), 'utf8');
  assert.match(de, /\*\*Pflicht:\*\*[\s\S]*jedem[\s\S]*Dokumentationsdeliverable[\s\S]*Prosa-Prüfung[\s\S]*de-DE\.md[\s\S]*durchgängig/u);
  assert.match(en, /\*\*Mandatory:\*\*[\s\S]*every[\s\S]*documentation[\s\S]*prose review[\s\S]*en-US\.md[\s\S]*throughout/u);
});

test('localized rules are generic for consumers and cover equivalent key sections', () => {
  const de = readFileSync(path.join(skillRoot, 'de-DE.md'), 'utf8');
  const en = readFileSync(path.join(skillRoot, 'en-US.md'), 'utf8');
  const sections = [
    ['Stilreferenz und Geltungsbereich', 'Voice reference and scope'],
    ['Arbeitsgrundsätze', 'Operating principles'],
    ['Inhalt und Fakten', 'Content and facts'],
    ['Sprache und Grammatik', 'Language and grammar'],
    ['Stil und Rhythmus', 'Style and rhythm'],
    ['Stimme und Persönlichkeit', 'Voice and personality'],
    ['Externe Community-Antworten', 'External community responses'],
    ['Chatbot-Reste und Quellen', 'Chatbot residue and sourcing'],
    ['Workflow', 'Workflow'],
    ['Qualitätskontrolle', 'Quality checks'],
  ];
  for (const [deSection, enSection] of sections) {
    assert.ok(de.includes(`## ${deSection}`), deSection);
    assert.ok(en.includes(`## ${enSection}`), enSection);
  }
  assert.doesNotMatch(`${de}\n${en}`, /src\/content\/blog\//u);
  assert.match(de, /vorhandene.*Stimmprobe.*explizit vorgegebenen Projektstil/su);
  assert.match(en, /existing voice sample.*explicit project style/su);
  assert.match(de, /neutral.*konkret/su);
  assert.match(en, /neutral.*concrete/su);
});

test('Humanizer routing fails closed instead of mixing languages and detectors remain advisory', () => {
  const router = readFileSync(path.join(skillRoot, 'SKILL.md'), 'utf8');
  assert.match(router, /`de` or `de-DE`.*de-DE\.md/su);
  assert.match(router, /`en` or `en-US`.*en-US\.md/su);
  assert.match(router, /exactly one localized rules file/u);
  assert.match(router, /stop.*prose operation/isu);
  assert.match(router, /Do not guess/u);
  assert.match(router, /Do not combine or sample/u);
  for (const language of ['de-DE.md', 'en-US.md']) {
    const text = readFileSync(path.join(skillRoot, language), 'utf8');
    assert.match(text, /Detectors and stylometry|Detektoren und Stilometrie/u);
    assert.match(text, /not a guarantee|keine Garantie/u);
    assert.match(text, /human review|menschliche Prüfung|Das eigentliche Gate/iu);
  }
});

test('Humanizer contains no runtime external repository dependency', () => {
  for (const file of files) {
    const text = readFileSync(path.join(skillRoot, file), 'utf8');
    assert.doesNotMatch(text, /https?:\/\/github\.com\/|gh api/u, file);
    assert.doesNotMatch(text, /ghp_|github_pat_/u, file);
  }
});
