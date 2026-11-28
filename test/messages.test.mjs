import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLanguage, translate, validateMessageCatalogs } from '../src/messages.mjs';

test('German and English catalogs have key and placeholder parity', () => {
  assert.doesNotThrow(validateMessageCatalogs);
});

test('language priority is CLI then project config then locale', () => {
  assert.equal(resolveLanguage('de', 'en', 'en_US').language, 'de');
  assert.equal(resolveLanguage(null, 'en', 'de_DE').language, 'en');
  assert.equal(resolveLanguage(null, null, 'de_DE').source, 'locale');
  assert.throws(() => resolveLanguage('fr', 'en'), /Unsupported installer language/);
  assert.throws(() => resolveLanguage(null, null, 'it_IT'), /Unsupported installer language/);
  assert.throws(() => resolveLanguage(null, null, 'de:en'), /Ambiguous installer language/);
  assert.equal(resolveLanguage('de', 'invalid', 'fr_FR').language, 'de');
});

test('single-message fallback is explicit', () => {
  const result = translate('de', 'install_complete', { count: 2 });
  assert.equal(result.language, 'de');
  assert.equal(result.fallback, false);
  assert.match(result.text, /2/);
  assert.throws(() => translate('de', 'does-not-exist'), /missing message for de/);
});
