import test from 'node:test';
import assert from 'node:assert/strict';
import { validateGradeResponse } from '../server/services/grading-validation.js';

const keyPoints = [{ id: 'k1' }, { id: 'k2' }];
const answer = 'The ready queue holds runnable processes.';

function response(results, incorrectStatements = []) {
  return JSON.stringify({ results, incorrectStatements });
}

test('accepts exact checklist coverage and exact evidence quotes', () => {
  const grade = validateGradeResponse(response([
    { keyPointId: 'k1', status: 'covered', evidence: 'ready queue' },
    { keyPointId: 'k2', status: 'missed', evidence: '' },
  ]), keyPoints, answer);
  assert.equal(grade.results.length, 2);
});

test('canonicalizes case, punctuation, and spacing differences to an exact source quote', () => {
  const grade = validateGradeResponse(response([
    { keyPointId: 'k1', status: 'covered', evidence: 'READY queue, HOLDS runnable processes' },
    { keyPointId: 'k2', status: 'missed', evidence: '' },
  ]), keyPoints, answer);
  assert.equal(grade.results[0].evidence, 'ready queue holds runnable processes');
});

test('canonicalizes incorrect statement quotes to exact source text', () => {
  const grade = validateGradeResponse(response([
    { keyPointId: 'k1', status: 'missed', evidence: '' },
    { keyPointId: 'k2', status: 'missed', evidence: '' },
  ], [{ userSaid: 'READY QUEUE, HOLDS RUNNABLE PROCESSES', correction: 'A correction.' }]), keyPoints, answer);
  assert.equal(grade.incorrectStatements[0].userSaid, 'ready queue holds runnable processes');
});

test('accepts JSON wrapped in markdown fences', () => {
  const output = `\`\`\`json\n${response([
    { keyPointId: 'k1', status: 'partial', evidence: 'runnable processes' },
    { keyPointId: 'k2', status: 'missed', evidence: '' },
  ])}\n\`\`\``;
  assert.equal(validateGradeResponse(output, keyPoints, answer).results.length, 2);
});

test('rejects missing, duplicated, unknown, and out-of-order checklist ids', () => {
  const invalidResults = [
    [{ keyPointId: 'k1', status: 'missed', evidence: '' }],
    [{ keyPointId: 'k1', status: 'missed', evidence: '' }, { keyPointId: 'k1', status: 'missed', evidence: '' }],
    [{ keyPointId: 'unknown', status: 'missed', evidence: '' }, { keyPointId: 'k2', status: 'missed', evidence: '' }],
    [{ keyPointId: 'k2', status: 'missed', evidence: '' }, { keyPointId: 'k1', status: 'missed', evidence: '' }],
  ];
  for (const results of invalidResults) assert.throws(() => validateGradeResponse(response(results), keyPoints, answer));
});

test('rejects fabricated evidence and non-empty evidence for missed points', () => {
  assert.throws(() => validateGradeResponse(response([
    { keyPointId: 'k1', status: 'covered', evidence: 'not in my answer' },
    { keyPointId: 'k2', status: 'missed', evidence: '' },
  ]), keyPoints, answer));
  assert.throws(() => validateGradeResponse(response([
    { keyPointId: 'k1', status: 'missed', evidence: 'ready queue' },
    { keyPointId: 'k2', status: 'missed', evidence: '' },
  ]), keyPoints, answer));
});

test('rejects incorrect-statement quotes that do not occur in the answer', () => {
  assert.throws(() => validateGradeResponse(response([
    { keyPointId: 'k1', status: 'missed', evidence: '' },
    { keyPointId: 'k2', status: 'missed', evidence: '' },
  ], [{ userSaid: 'fabricated', correction: 'A correction.' }]), keyPoints, answer));
});
