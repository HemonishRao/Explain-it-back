import test from 'node:test';
import assert from 'node:assert/strict';

import { createStudyItems, getFolders } from '../client/src/api/materials.js';

test('getFolders surfaces a friendly fallback error when the server returns non-JSON HTML', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('<html>502 Bad Gateway</html>', {
    status: 502,
    headers: { 'Content-Type': 'text/html' },
  });
  try {
    await assert.rejects(getFolders(), /Could not load folders\./);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('getFolders surfaces the server JSON error message when present', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Database unavailable.' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });
  try {
    await assert.rejects(getFolders(), /Database unavailable\./);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('createStudyItems deduplicates concurrent requests for the same attempt', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return new Response(JSON.stringify({ attemptId: 'a1', topicId: 't1', items: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  try {
    const [first, second] = await Promise.all([createStudyItems('a1'), createStudyItems('a1')]);
    assert.equal(calls, 1);
    assert.deepEqual(first, second);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
