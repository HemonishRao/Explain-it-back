import test from 'node:test';
import assert from 'node:assert/strict';
import { extractTopics } from '../server/services/extraction.js';

const validTopics = JSON.stringify({ topics: [{
  id: 't1',
  title: 'Process Scheduling',
  summary: 'This topic covers how runnable work receives CPU time.',
  keyPoints: [{ id: 'k1', text: 'A scheduler chooses a runnable process.', importance: 3 }],
}] });

test('extracts validated topics and replaces model ids with stored ids', async () => {
  let calls = 0;
  const topics = await extractTopics('Scheduler notes', async (input) => {
    calls += 1;
    assert.equal(input.temperature, 0.2);
    assert.match(input.user, /<<<MATERIAL_START>>>/);
    return validTopics;
  });
  assert.equal(calls, 1);
  assert.equal(topics[0].title, 'Process Scheduling');
  assert.notEqual(topics[0].id, 't1');
  assert.notEqual(topics[0].keyPoints[0].id, 'k1');
});

test('retries once when extraction JSON is malformed', async () => {
  let calls = 0;
  const topics = await extractTopics('Scheduler notes', async () => {
    calls += 1;
    return calls === 1 ? 'not json' : validTopics;
  });
  assert.equal(calls, 2);
  assert.equal(topics.length, 1);
});

test('does not retry when the provider request itself fails', async () => {
  let calls = 0;
  await assert.rejects(extractTopics('Scheduler notes', async () => {
    calls += 1;
    throw Object.assign(new Error('provider unavailable'), { status: 502 });
  }), /provider unavailable/);
  assert.equal(calls, 1);
});

test('extracts short material once without invoking the merge prompt', async () => {
  let calls = 0;
  const topics = await extractTopics('A short set of notes.', async (input) => {
    calls += 1;
    assert.equal(input.temperature, 0.2);
    return validTopics;
  });
  assert.equal(calls, 1);
  assert.equal(topics.length, 1);
});

test('extracts long material in chunks, merges once at temperature zero, and assigns unique ids', async () => {
  let calls = 0;
  const topics = await extractTopics(`${'A study paragraph about scheduling. '.repeat(180)}`, async (input) => {
    calls += 1;
    if (input.system.includes('cleaning up a list')) {
      assert.equal(input.temperature, 0);
      assert.match(input.user, /<<<TOPICS_START>>>/);
      return validTopics;
    }
    assert.equal(input.temperature, 0.2);
    return validTopics;
  });
  assert.ok(calls > 2);
  assert.equal(topics.length, 1);
  assert.notEqual(topics[0].id, 't1');
  assert.notEqual(topics[0].keyPoints[0].id, 'k1');
});
