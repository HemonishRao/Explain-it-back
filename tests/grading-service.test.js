import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_PATH = ':memory:';
const { getAttemptDetails, saveMaterial } = await import('../server/db.js');
const { gradeExplanation } = await import('../server/services/grading.js');

let fixtureNumber = 0;

function createFixture() {
  fixtureNumber += 1;
  const materialId = `grading-material-${fixtureNumber}`;
  const topicId = `grading-topic-${fixtureNumber}`;
  const keyPoints = [
    { id: `grading-k1-${fixtureNumber}`, text: 'A scheduler selects a ready process.', importance: 3 },
    { id: `grading-k2-${fixtureNumber}`, text: 'A timer interrupt regains control at the quantum boundary.', importance: 2 },
    { id: `grading-k3-${fixtureNumber}`, text: 'A dispatcher performs the context switch.', importance: 1 },
  ];
  saveMaterial({ id: materialId, title: 'Synthetic test', text: 'Synthetic notes', topics: [{ id: topicId, title: 'Scheduling', summary: 'A synthetic topic.', keyPoints }] });
  return { topicId, keyPoints };
}

function validGrade(keyPoints, answer) {
  return JSON.stringify({
    results: [
      { keyPointId: keyPoints[0].id, status: 'covered', evidence: 'scheduler selects a ready process' },
      { keyPointId: keyPoints[1].id, status: 'partial', evidence: 'timer interrupt regains control' },
      { keyPointId: keyPoints[2].id, status: 'missed', evidence: '' },
    ],
    incorrectStatements: [{ userSaid: 'scheduler selects a ready process', correction: 'A scheduler selects a ready process.' }],
  });
}

const answer = 'The scheduler selects a ready process. A timer interrupt regains control.';

test('grades, computes weighted score in code, and persists result details', async () => {
  const { topicId, keyPoints } = createFixture();
  let calls = 0;
  const attempt = await gradeExplanation(topicId, answer, async (input) => {
    calls += 1;
    assert.equal(input.temperature, 0);
    assert.match(input.user, /<<<EXPLANATION_START>>>/);
    return validGrade(keyPoints, answer);
  });
  assert.equal(calls, 1);
  assert.equal(attempt.score, 66.7);
  const saved = getAttemptDetails(attempt.attemptId);
  assert.deepEqual(saved.results.map(({ status }) => status), ['covered', 'partial', 'missed']);
  assert.equal(saved.incorrectStatements.length, 1);
});

test('retries once for an invalid grading response', async () => {
  const { topicId, keyPoints } = createFixture();
  let calls = 0;
  const attempt = await gradeExplanation(topicId, answer, async () => {
    calls += 1;
    return calls === 1 ? '{broken json' : validGrade(keyPoints, answer);
  });
  assert.equal(calls, 2);
  assert.equal(attempt.score, 66.7);
});

test('gives validation guidance on the single grading retry', async () => {
  const { topicId, keyPoints } = createFixture();
  const prompts = [];
  await gradeExplanation(topicId, answer, async (input) => {
    prompts.push(input.user);
    return prompts.length === 1 ? '{broken json' : validGrade(keyPoints, answer);
  });
  assert.doesNotMatch(prompts[0], /RETRY NOTICE/);
  assert.match(prompts[1], /RETRY NOTICE/);
  assert.match(prompts[1], /exact quote of at most 25 words/);
  assert.match(prompts[1], /<<<EXPLANATION_START>>>/);
  assert.match(prompts[1], /<<<EXPLANATION_END>>>/);
});

test('blank explanation is saved as zero without calling the provider', async () => {
  const { topicId } = createFixture();
  const attempt = await gradeExplanation(topicId, '', async () => { throw new Error('should not be called'); });
  assert.equal(attempt.score, 0);
  assert.deepEqual(getAttemptDetails(attempt.attemptId).results.map(({ status, evidence }) => [status, evidence]), [
    ['missed', ''], ['missed', ''], ['missed', ''],
  ]);
});

test('provider failures are not repeated by the grading service', async () => {
  const { topicId } = createFixture();
  let calls = 0;
  await assert.rejects(gradeExplanation(topicId, answer, async () => {
    calls += 1;
    throw Object.assign(new Error('provider unavailable'), { status: 502 });
  }), /provider unavailable/);
  assert.equal(calls, 1);
});

test('unknown topics return a not-found error', async () => {
  await assert.rejects(gradeExplanation('missing-topic', answer), { status: 404 });
});
