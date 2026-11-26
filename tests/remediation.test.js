import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_PATH = ':memory:';
const { saveAttempt, saveMaterial } = await import('../server/db.js');
const { generateStudyItems } = await import('../server/services/remediation.js');

let fixtureNumber = 0;

function createAttemptFixture(statuses = ['covered', 'missed']) {
  fixtureNumber += 1;
  const topicId = `remediation-topic-${fixtureNumber}`;
  const attemptId = `remediation-attempt-${fixtureNumber}`;
  const keyPoints = [
    { id: `rem-k1-${fixtureNumber}`, text: 'First core idea.', importance: 3 },
    { id: `rem-k2-${fixtureNumber}`, text: 'Second core idea.', importance: 2 },
  ];
  saveMaterial({
    id: `rem-mat-${fixtureNumber}`,
    title: 'Remediation material',
    text: 'Notes',
    topics: [{ id: topicId, title: 'Memory Management', summary: 'Summary', keyPoints }],
  });
  saveAttempt({
    id: attemptId,
    topicId,
    answerText: 'Answer',
    score: statuses.every((s) => s === 'covered') ? 100 : 60,
    results: statuses.map((status, index) => ({
      id: `rem-res-${fixtureNumber}-${index}`,
      keyPointId: keyPoints[index].id,
      status,
      evidence: status === 'covered' ? 'Answer' : '',
    })),
    incorrectStatements: [],
  });
  return { attemptId, keyPoints };
}

test('generates, caches, and reloads study items for missed or partial points', async () => {
  const { attemptId, keyPoints } = createAttemptFixture(['covered', 'missed']);
  let calls = 0;
  const llm = async () => {
    calls += 1;
    return JSON.stringify({
      items: [{
        keyPointId: keyPoints[1].id,
        keywords: ['paging', 'frames', 'page table'],
        flashcards: [
          { front: 'Why use paging?', back: 'It avoids contiguous memory allocation.' },
          { front: 'What maps pages to frames?', back: 'The page table.' },
        ],
      }],
    });
  };

  const first = await generateStudyItems(attemptId, llm);
  assert.equal(calls, 1);
  assert.equal(first.items.length, 1);
  assert.deepEqual(first.items[0].keywords, ['paging', 'frames', 'page table']);

  const second = await generateStudyItems(attemptId, llm);
  assert.equal(calls, 1);
  assert.equal(second.items.length, 1);
});

test('returns empty items without calling the LLM when all points are covered', async () => {
  const { attemptId } = createAttemptFixture(['covered', 'covered']);
  let calls = 0;
  const result = await generateStudyItems(attemptId, async () => {
    calls += 1;
    return '{}';
  });
  assert.equal(calls, 0);
  assert.deepEqual(result.items, []);
});

test('retries once when remediation output is invalid', async () => {
  const { attemptId, keyPoints } = createAttemptFixture(['partial', 'covered']);
  let calls = 0;
  const result = await generateStudyItems(attemptId, async () => {
    calls += 1;
    if (calls === 1) return '{"items": []}';
    return JSON.stringify({
      items: [{
        keyPointId: keyPoints[0].id,
        keywords: ['virtual memory', 'swap', 'page fault'],
        flashcards: [
          { front: 'What triggers a page fault?', back: 'Accessing a page not currently in RAM.' },
          { front: 'Why use virtual memory?', back: 'It lets programs exceed physical RAM.' },
        ],
      }],
    });
  });
  assert.equal(calls, 2);
  assert.equal(result.items.length, 1);
});
