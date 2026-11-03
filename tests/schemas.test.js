import test from 'node:test';
import assert from 'node:assert/strict';
import { attemptRequestSchema, gradingResponseSchema, materialRequestSchema } from '../server/schemas.js';

test('material text accepts 50,000 characters and rejects longer input', () => {
  assert.equal(materialRequestSchema.safeParse({ text: 'x'.repeat(50_000) }).success, true);
  assert.equal(materialRequestSchema.safeParse({ text: 'x'.repeat(50_001) }).success, false);
  assert.equal(materialRequestSchema.safeParse({ text: '   ' }).success, false);
});

test('material upload can target an existing folder or create a new one', () => {
  assert.equal(materialRequestSchema.safeParse({ text: 'Notes', folderId: 'folder-one' }).success, true);
  assert.equal(materialRequestSchema.safeParse({ text: 'Notes', folderName: 'Cloud notes' }).success, true);
  assert.equal(materialRequestSchema.safeParse({ text: 'Notes', folderId: 'folder-one', folderName: 'Cloud notes' }).success, false);
  assert.equal(materialRequestSchema.safeParse({ text: 'Notes', folderName: '   ' }).success, false);
});

test('explanation accepts empty text and enforces the 5,000-character limit', () => {
  assert.equal(attemptRequestSchema.safeParse({ answerText: '' }).success, true);
  assert.equal(attemptRequestSchema.safeParse({ answerText: 'x'.repeat(5_000) }).success, true);
  assert.equal(attemptRequestSchema.safeParse({ answerText: 'x'.repeat(5_001) }).success, false);
});

test('grading schema rejects a score supplied by the LLM', () => {
  const result = gradingResponseSchema.safeParse({ score: 100, results: [], incorrectStatements: [] });
  assert.equal(result.success, false);
});
