import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_PATH = ':memory:';
const { saveAttempt, saveMaterial } = await import('../server/db.js');
const { createApp } = await import('../server/app.js');

async function startServer(corsOrigin = '') {
  const app = createApp({ corsOrigin });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

test('health endpoint and unknown API route respond with JSON', async () => {
  const srv = await startServer();
  try {
    const health = await fetch(`${srv.baseUrl}/api/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok' });

    const missing = await fetch(`${srv.baseUrl}/api/does-not-exist`);
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error: 'API route not found.' });
  } finally {
    await srv.close();
  }
});

test('CORS rejects disallowed origins on both preflight and POST requests', async () => {
  const srv = await startServer('https://allowed.example');
  try {
    const preflight = await fetch(`${srv.baseUrl}/api/folders`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example' },
    });
    assert.equal(preflight.status, 403);

    const post = await fetch(`${srv.baseUrl}/api/materials`, {
      method: 'POST',
      headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'hello' }),
    });
    assert.equal(post.status, 403);

    const allowed = await fetch(`${srv.baseUrl}/api/health`, {
      headers: { Origin: 'https://allowed.example' },
    });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://allowed.example');
  } finally {
    await srv.close();
  }
});

test('topics route hides key points and attempts routes handle blank answers and 404s', async () => {
  const topicId = 'route-topic-1';
  const attemptId = 'route-attempt-1';
  saveMaterial({
    id: 'route-mat-1',
    title: 'OS Notes',
    text: 'Notes',
    folderName: 'OS Folder',
    topics: [{
      id: topicId,
      title: 'Paging',
      summary: 'Maps virtual addresses to physical frames.',
      keyPoints: [{ id: 'route-kp-1', text: 'Page tables map pages to frames.', importance: 3 }],
    }],
  });
  saveAttempt({
    id: attemptId,
    topicId,
    answerText: 'Sample answer',
    score: 100,
    results: [{ id: 'route-res-1', keyPointId: 'route-kp-1', status: 'covered', evidence: 'Sample answer' }],
    incorrectStatements: [],
  });

  const srv = await startServer();
  try {
    const topicRes = await fetch(`${srv.baseUrl}/api/topics/${topicId}`);
    assert.equal(topicRes.status, 200);
    const topicBody = await topicRes.json();
    assert.equal(topicBody.topic.title, 'Paging');
    assert.equal(topicBody.topic.keyPoints, undefined);

    const missingTopic = await fetch(`${srv.baseUrl}/api/topics/unknown-id`);
    assert.equal(missingTopic.status, 404);

    const blankAttempt = await fetch(`${srv.baseUrl}/api/topics/${topicId}/attempts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answerText: '   ' }),
    });
    assert.equal(blankAttempt.status, 201);
    const blankBody = await blankAttempt.json();
    assert.equal(blankBody.score, 0);

    const resultsRes = await fetch(`${srv.baseUrl}/api/attempts/${attemptId}`);
    assert.equal(resultsRes.status, 200);
    const resultsBody = await resultsRes.json();
    assert.equal(resultsBody.results.length, 1);

    const historyRes = await fetch(`${srv.baseUrl}/api/topics/${topicId}/attempts`);
    assert.equal(historyRes.status, 200);
    const historyBody = await historyRes.json();
    assert.equal(historyBody.attempts.length, 2);
  } finally {
    await srv.close();
  }
});

test('materials route rejects invalid uploads, empty txt files, and unknown folders', async () => {
  const srv = await startServer();
  try {
    const badFolder = await fetch(`${srv.baseUrl}/api/materials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Valid study notes', folderId: 'missing-folder-id' }),
    });
    assert.equal(badFolder.status, 404);

    const fakePdfForm = new FormData();
    fakePdfForm.append('folderName', 'Test');
    fakePdfForm.append('file', new Blob(['not a pdf'], { type: 'application/pdf' }), 'fake.pdf');
    const fakePdf = await fetch(`${srv.baseUrl}/api/materials`, { method: 'POST', body: fakePdfForm });
    assert.equal(fakePdf.status, 415);

    const unsupportedForm = new FormData();
    unsupportedForm.append('folderName', 'Test');
    unsupportedForm.append('file', new Blob(['png bytes'], { type: 'image/png' }), 'image.png');
    const unsupported = await fetch(`${srv.baseUrl}/api/materials`, { method: 'POST', body: unsupportedForm });
    assert.equal(unsupported.status, 415);

    const emptyTxtForm = new FormData();
    emptyTxtForm.append('folderName', 'Test');
    emptyTxtForm.append('file', new Blob(['   '], { type: 'text/plain' }), 'notes.txt');
    const emptyTxt = await fetch(`${srv.baseUrl}/api/materials`, { method: 'POST', body: emptyTxtForm });
    assert.equal(emptyTxt.status, 400);
  } finally {
    await srv.close();
  }
});

test('material topics, material deletion, and hint 404 routes respond cleanly', async () => {
  const materialId = 'route-mat-manage-1';
  const topicId = 'route-topic-manage-1';
  saveMaterial({
    id: materialId,
    title: 'Manageable Notes',
    text: 'Notes',
    folderName: 'Manageable Folder',
    topics: [{
      id: topicId,
      title: 'Threads',
      summary: 'Lightweight execution units inside a process.',
      keyPoints: [{ id: 'route-kp-manage-1', text: 'Threads share an address space.', importance: 3 }],
    }],
  });
  saveAttempt({
    id: 'route-attempt-manage-1',
    topicId,
    answerText: 'Threads share memory.',
    score: 100,
    results: [{ id: 'route-res-manage-1', keyPointId: 'route-kp-manage-1', status: 'covered', evidence: 'Threads share memory' }],
    incorrectStatements: [],
  });

  const srv = await startServer();
  try {
    const topicsRes = await fetch(`${srv.baseUrl}/api/materials/${materialId}/topics`);
    assert.equal(topicsRes.status, 200);
    const topicsBody = await topicsRes.json();
    assert.equal(topicsBody.topics[0].latestScore, 100);
    assert.equal(topicsBody.topics[0].attemptCount, 1);

    const missingTopics = await fetch(`${srv.baseUrl}/api/materials/unknown-mat-id/topics`);
    assert.equal(missingTopics.status, 404);

    const missingHint = await fetch(`${srv.baseUrl}/api/topics/unknown-id/hint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ explanationSoFar: '' }),
    });
    assert.equal(missingHint.status, 404);

    const deleteRes = await fetch(`${srv.baseUrl}/api/materials/${materialId}`, { method: 'DELETE' });
    assert.equal(deleteRes.status, 200);
    assert.deepEqual(await deleteRes.json(), { deleted: true });

    const deleteAgain = await fetch(`${srv.baseUrl}/api/materials/${materialId}`, { method: 'DELETE' });
    assert.equal(deleteAgain.status, 404);
  } finally {
    await srv.close();
  }
});
