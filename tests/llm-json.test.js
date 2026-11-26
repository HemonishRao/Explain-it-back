import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLlmJson } from '../server/services/llm-json.js';

test('parses plain JSON and fenced JSON blocks', () => {
  assert.deepEqual(parseLlmJson('{"ok": true}'), { ok: true });
  assert.deepEqual(parseLlmJson('```json\n{"ok": true}\n```'), { ok: true });
});

test('extracts a JSON object surrounded by brief prose', () => {
  const output = 'Here is the JSON:\n{"topics": []}\nDone.';
  assert.deepEqual(parseLlmJson(output), { topics: [] });
});

test('throws when no valid JSON object is present', () => {
  assert.throws(() => parseLlmJson('not json at all'), SyntaxError);
});
