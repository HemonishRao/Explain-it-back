import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_PATH = ':memory:';
const { saveMaterial } = await import('../server/db.js');
const { generateTopicHint } = await import('../server/services/hint.js');

let fixtureNumber = 0;

function createTopicFixture() {
  fixtureNumber += 1;
  const topicId = `hint-topic-${fixtureNumber}`;
  saveMaterial({
    id: `hint-mat-${fixtureNumber}`,
    title: 'Hint material',
    text: 'Notes',
    topics: [{
      id: topicId,
      title: 'Virtual Memory',
      summary: 'Allows programs to address more memory than physical RAM.',
      keyPoints: [
        { id: `hint-kp-1-${fixtureNumber}`, text: 'The page table maps virtual pages to physical frames.', importance: 3 },
        { id: `hint-kp-2-${fixtureNumber}`, text: 'A page fault occurs when a referenced page is not in RAM.', importance: 2 },
      ],
    }],
  });
  return { topicId };
}

test('generates a validated hint at temperature 0.3 with explanation delimiters', async () => {
  const { topicId } = createTopicFixture();
  let calls = 0;
  const result = await generateTopicHint(topicId, 'Memory uses addresses.', async (input) => {
    calls += 1;
    assert.equal(input.temperature, 0.3);
    assert.match(input.user, /<<<EXPLANATION_START>>>/);
    assert.match(input.user, /<<<EXPLANATION_END>>>/);
    return JSON.stringify({ hint: 'page table' });
  });
  assert.equal(calls, 1);
  assert.deepEqual(result, { hint: 'page table' });
});

test('retries once when hint JSON is malformed or invalid', async () => {
  const { topicId } = createTopicFixture();
  let calls = 0;
  const result = await generateTopicHint(topicId, '', async () => {
    calls += 1;
    return calls === 1 ? 'not json' : JSON.stringify({ hint: 'physical frames' });
  });
  assert.equal(calls, 2);
  assert.deepEqual(result, { hint: 'physical frames' });
});

test('throws a 404 error for an unknown topic id', async () => {
  await assert.rejects(
    generateTopicHint('missing-topic-id', ''),
    (error) => error.status === 404 && /Topic not found/.test(error.message),
  );
});
