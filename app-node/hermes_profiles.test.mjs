import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProfileName, InvalidProfileName } from './hermes_profiles.mjs';

test('validateProfileName accepts canonical names', () => {
  for (const name of ['acme', 'llm-wiki', 'verbalcoding', 'a', 'a1_b-c']) {
    validateProfileName(name);
  }
});

test('validateProfileName rejects invalid names', () => {
  const bad = ['', 'Acme', 'llm.wiki', 'has space', '_leading', '-leading', '한글', 'a'.repeat(65)];
  for (const name of bad) {
    assert.throws(() => validateProfileName(name), InvalidProfileName, `expected ${JSON.stringify(name)} to throw`);
  }
});
