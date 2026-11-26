import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAnswers, renderQuestionBlock, replaceQuestionBlock } from '../.squad/heroes/companion/scripts/reqeng-block.mjs';

const questions = [
  { number: 5, title: 'Version trust', blocking: true, owner: 'human', options: ['moderate', 'strict'] },
  { number: 6, title: 'Permission', blocking: false, owner: 'Nick', options: ['read', 'write'] },
];

test('bundled answers are parsed only from displayed options', () => {
  assert.deepEqual(parseAnswers('5b, 6a', questions), ['5b', '6a']);
  assert.throws(() => parseAnswers('5c, 7a', questions), /invalid or ambiguous/);
});

test('Ralph marker block is updated in place instead of duplicated', () => {
  const first = replaceQuestionBlock('Issue body\n', questions);
  const second = replaceQuestionBlock(first, questions);
  assert.equal(second.match(/<!-- squad:reqeng-questions -->/gu)?.length, 1);
  assert.equal(second.match(/<!-- \/squad:reqeng-questions -->/gu)?.length, 1);
  assert.throws(() => replaceQuestionBlock(`${first}\n${renderQuestionBlock(questions)}`, questions), /ambiguous/);
});
