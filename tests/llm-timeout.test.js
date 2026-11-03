import test from 'node:test';
import assert from 'node:assert/strict';
import { isDailyQuotaError, isRetryable, withTimeout } from '../server/services/llm.js';

test('aborts a Gemini request and reports a gateway timeout', async () => {
  let signal;
  await assert.rejects(withTimeout((requestSignal) => {
    signal = requestSignal;
    return new Promise((resolve, reject) => {
      requestSignal.addEventListener('abort', () => reject(new Error('aborted')));
    });
  }, 10), (error) => error.status === 504 && error.message === 'LLM request timed out');
  assert.equal(signal.aborted, true);
});

test('returns a Gemini response before the timeout', async () => {
  const result = await withTimeout(async () => 'ok', 100);
  assert.equal(result, 'ok');
});

test('does not retry a daily free-tier quota response', () => {
  const error = Object.assign(new Error('Request limit: 20 requests per day on Free Tier'), { status: 429 });
  assert.equal(isDailyQuotaError(error), true);
  assert.equal(isRetryable(error), false);
});

test('keeps retrying transient rate limits', () => {
  assert.equal(isRetryable(Object.assign(new Error('Too many requests'), { status: 429 })), true);
});
