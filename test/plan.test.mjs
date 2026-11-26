import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyOperation, mergeManagedSection } from '../src/plan.mjs';
import { cleanup, fixture, write } from './helpers.mjs';

test('managed sections preserve bytes outside the approved marker range', () => {
  const existing = 'before\r\n<!-- squad-heroes:x:begin -->\r\nold\r\n<!-- squad-heroes:x:end -->\r\nafter\r\n';
  const incoming = '<!-- squad-heroes:x:begin -->\nnew\n<!-- squad-heroes:x:end -->\n';
  assert.equal(
    mergeManagedSection(existing, incoming, 'x', 'use'),
    `before\r\n${incoming.replace(/\n$/u, '')}\r\nafter\r\n`
  );
});

test('ambiguous markers are conflicts, never whole-file writes', () => {
  const root = fixture();
  try {
    write(root, '.squad/team.md', 'local team without markers\n');
    const operation = classifyOperation(root, {
      id: 'team',
      target: '.squad/team.md',
      rendered: '<!-- squad-heroes:team:begin -->new<!-- squad-heroes:team:end -->',
      mode: 'managed-section',
      section: 'team',
    });
    assert.equal(operation.action, 'conflict');
    assert.deepEqual(operation.options, ['use', 'keep', 'merge', 'abort']);
  } finally {
    cleanup(root);
  }
});

test('history append is idempotent and never rewrites existing bytes', () => {
  const root = fixture();
  try {
    write(root, '.squad/agents/tony/history.md', 'old\n');
    const item = { id: 'history', target: '.squad/agents/tony/history.md', rendered: '', appendId: '<!-- once -->', mode: 'append-only' };
    const first = classifyOperation(root, item);
    assert.equal(first.action, 'append');
    assert.equal(first.content, 'old\n\n<!-- once -->\n');
    write(root, item.target, first.content);
    assert.equal(classifyOperation(root, item).action, 'noop');
  } finally {
    cleanup(root);
  }
});
