import test from 'node:test';
import assert from 'node:assert/strict';
import { splitMaterialIntoChunks } from '../server/services/chunking.js';

test('keeps short material as one chunk', () => {
  const material = 'Short study notes.';
  assert.deepEqual(splitMaterialIntoChunks(material), [material]);
});

test('splits long material near paragraph boundaries with overlapping context', () => {
  const paragraphs = Array.from({ length: 12 }, (_, index) => `Paragraph ${index + 1}. ${'Study detail. '.repeat(25)}`);
  const material = paragraphs.join('\n\n');
  const chunks = splitMaterialIntoChunks(material, 1_000, 100);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length <= 1_000));
  for (let index = 0; index < paragraphs.length; index += 1) {
    assert.ok(chunks.some((chunk) => chunk.includes(`Paragraph ${index + 1}.`)));
  }
  assert.ok(chunks.slice(1).some((chunk, index) => chunks[index].slice(-100).split(/\s+/).some((word) => word && chunk.includes(word))));
});
