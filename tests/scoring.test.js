import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateScore } from '../server/services/scoring.js';

const keyPoints = [
  { id: 'k1', importance: 3 },
  { id: 'k2', importance: 2 },
  { id: 'k3', importance: 1 },
];

test('score uses checklist importance weights and partial value 0.5', () => {
  const results = [
    { keyPointId: 'k1', status: 'covered' },
    { keyPointId: 'k2', status: 'partial' },
    { keyPointId: 'k3', status: 'missed' },
  ];
  assert.equal(calculateScore(results, keyPoints), 66.7);
});

test('all covered scores 100 and all missed scores zero', () => {
  assert.equal(calculateScore(keyPoints.map(({ id }) => ({ keyPointId: id, status: 'covered' })), keyPoints), 100);
  assert.equal(calculateScore(keyPoints.map(({ id }) => ({ keyPointId: id, status: 'missed' })), keyPoints), 0);
});

test('zero-importance checklist cannot produce a NaN score', () => {
  assert.equal(calculateScore([], []), 0);
});
