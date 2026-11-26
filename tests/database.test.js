import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_PATH = ':memory:';
const { deleteFolder, deleteMaterial, getAttemptDetails, getFoldersWithTopics, getStudyItems, getTopicAttemptHistory, getTopicForExplain, getTopicKeyPoints, getTopicsForMaterial, getWeakPointsForAttempt, materialExists, saveAttempt, saveMaterial, saveStudyItems } = await import('../server/db.js');

test('stores materials, topics, and key points without exposing key points in topic summaries', () => {
  saveMaterial({
    id: 'm-test',
    title: 'Test material',
    text: 'Test source text',
    topics: [{ id: 't-test', title: 'Test topic', summary: 'A short summary.', keyPoints: [{ id: 'k-test', text: 'A checklist idea.', importance: 3 }] }],
  });
  assert.equal(materialExists('m-test'), true);
  assert.deepEqual(getTopicsForMaterial('m-test'), [{
    id: 't-test',
    title: 'Test topic',
    summary: 'A short summary.',
    latestScore: null,
    attemptCount: 0,
  }]);
  assert.equal(getTopicForExplain('t-test').summary, 'A short summary.');
  assert.deepEqual(getTopicKeyPoints('t-test'), [{ id: 'k-test', text: 'A checklist idea.', importance: 3 }]);
  assert.equal(materialExists('missing'), false);
});

test('groups source materials and topics under a shared folder', () => {
  const folderId = saveMaterial({
    id: 'm-folder-one',
    title: 'AWS overview',
    folderName: 'Cloud computing',
    text: 'First source.',
    topics: [{ id: 't-folder-one', title: 'AWS basics', summary: 'AWS overview.', keyPoints: [{ id: 'k-folder-one', text: 'A cloud platform.', importance: 3 }] }],
  });
  const secondFolderId = saveMaterial({
    id: 'm-folder-two',
    title: 'Cloud pricing',
    folderId,
    text: 'Second source.',
    topics: [{ id: 't-folder-two', title: 'Pricing', summary: 'Cloud pricing.', keyPoints: [{ id: 'k-folder-two', text: 'Pay for use.', importance: 2 }] }],
  });
  assert.equal(secondFolderId, folderId);
  const folder = getFoldersWithTopics().find((item) => item.id === folderId);
  assert.equal(folder.name, 'Cloud computing');
  assert.equal(folder.materialCount, 2);
  assert.equal(folder.topicCount, 2);
  assert.deepEqual(folder.materials.map((material) => material.title), ['AWS overview', 'Cloud pricing']);
  assert.deepEqual(folder.materials.map((material) => material.topics[0].title), ['AWS basics', 'Pricing']);
});

test('deleting a folder removes its sources, topics, and attempt history', () => {
  const folderId = saveMaterial({
    id: 'm-folder-delete',
    title: 'Disposable source',
    folderName: 'Disposable folder',
    text: 'Source to delete.',
    topics: [{ id: 't-folder-delete', title: 'Disposable topic', summary: 'Topic to delete.', keyPoints: [{ id: 'k-folder-delete', text: 'Point to delete.', importance: 1 }] }],
  });
  saveAttempt({
    id: 'a-folder-delete', topicId: 't-folder-delete', answerText: 'A test answer.', score: 0,
    results: [{ id: 'r-folder-delete', keyPointId: 'k-folder-delete', status: 'missed', evidence: '' }], incorrectStatements: [],
  });
  saveStudyItems('a-folder-delete', [{
    id: 's-folder-delete', keyPointId: 'k-folder-delete', keywords: ['one', 'two', 'three'],
    flashcards: [{ front: 'Question one?', back: 'Answer one.' }, { front: 'Question two?', back: 'Answer two.' }],
  }]);
  assert.equal(deleteFolder(folderId), true);
  assert.equal(deleteFolder(folderId), false);
  assert.equal(materialExists('m-folder-delete'), false);
  assert.equal(getAttemptDetails('a-folder-delete'), null);
  assert.equal(getFoldersWithTopics().some((folder) => folder.id === folderId), false);
});

test('saves and reloads an attempt with its checklist and incorrect statements', () => {
  saveAttempt({
    id: 'a-test',
    topicId: 't-test',
    answerText: 'A checklist idea.',
    score: 100,
    results: [{ id: 'r-test', keyPointId: 'k-test', status: 'covered', evidence: 'A checklist idea.' }],
    incorrectStatements: [{ id: 'i-test', userSaid: 'wrong claim', correction: 'A correction.' }],
  });
  const details = getAttemptDetails('a-test');
  assert.equal(details.attempt.topicTitle, 'Test topic');
  assert.equal(details.attempt.score, 100);
  assert.deepEqual(details.results, [{ keyPointId: 'k-test', text: 'A checklist idea.', importance: 3, status: 'covered', evidence: 'A checklist idea.' }]);
  assert.deepEqual(details.incorrectStatements, [{ userSaid: 'wrong claim', correction: 'A correction.' }]);
  assert.equal(getAttemptDetails('missing'), null);
});

test('foreign keys reject attempts that point to unknown topics', () => {
  assert.throws(() => saveAttempt({ id: 'a-orphan', topicId: 'missing', answerText: '', score: 0, results: [], incorrectStatements: [] }));
  assert.equal(getAttemptDetails('a-orphan'), null);
});

test('stores study aids only for missed or partial points and reloads their JSON fields', () => {
  saveAttempt({
    id: 'a-study', topicId: 't-test', answerText: '', score: 0,
    results: [{ id: 'r-study', keyPointId: 'k-test', status: 'missed', evidence: '' }], incorrectStatements: [],
  });
  assert.deepEqual(getWeakPointsForAttempt('a-study'), [{ id: 'k-test', text: 'A checklist idea.', status: 'missed' }]);
  saveStudyItems('a-study', [{
    id: 's-study', keyPointId: 'k-test', keywords: ['checklist', 'idea', 'memory'],
    flashcards: [{ front: 'What is the idea?', back: 'A checklist idea.' }, { front: 'What should you recall?', back: 'The checklist.' }],
  }]);
  saveStudyItems('a-study', [{
    id: 's-study-duplicate', keyPointId: 'k-test', keywords: ['duplicate', 'retry', 'request'],
    flashcards: [{ front: 'Duplicate question?', back: 'Duplicate answer.' }, { front: 'Another duplicate?', back: 'Another answer.' }],
  }]);
  assert.deepEqual(getStudyItems('a-study'), [{
    keyPointId: 'k-test', keyPointText: 'A checklist idea.', keywords: ['checklist', 'idea', 'memory'],
    flashcards: [{ front: 'What is the idea?', back: 'A checklist idea.' }, { front: 'What should you recall?', back: 'The checklist.' }],
  }]);
});

test('returns a topic’s attempts in chronological order and handles topics without attempts', () => {
  const history = getTopicAttemptHistory('t-test');
  assert.equal(history.topic.title, 'Test topic');
  assert.deepEqual(history.attempts.map(({ id, score }) => ({ id, score })), [
    { id: 'a-test', score: 100 },
    { id: 'a-study', score: 0 },
  ]);
  assert.deepEqual(getTopicAttemptHistory('missing'), null);
  assert.deepEqual(getTopicAttemptHistory('t-test').attempts, history.attempts);
});

test('reports latestScore and attemptCount in topic listings and folders', () => {
  const folderId = saveMaterial({
    id: 'm-score-check',
    title: 'Score material',
    folderName: 'Score folder',
    text: 'Notes',
    topics: [{ id: 't-score-check', title: 'Score topic', summary: 'Summary.', keyPoints: [{ id: 'k-score-check', text: 'Point.', importance: 3 }] }],
  });
  saveAttempt({
    id: 'a-score-1', topicId: 't-score-check', answerText: 'First', score: 45,
    results: [{ id: 'r-score-1', keyPointId: 'k-score-check', status: 'partial', evidence: 'First' }], incorrectStatements: [],
  });
  saveAttempt({
    id: 'a-score-2', topicId: 't-score-check', answerText: 'Second', score: 85,
    results: [{ id: 'r-score-2', keyPointId: 'k-score-check', status: 'covered', evidence: 'Second' }], incorrectStatements: [],
  });

  const materialTopics = getTopicsForMaterial('m-score-check');
  assert.equal(materialTopics[0].latestScore, 85);
  assert.equal(materialTopics[0].attemptCount, 2);

  const folder = getFoldersWithTopics().find((item) => item.id === folderId);
  assert.equal(folder.materials[0].topics[0].latestScore, 85);
  assert.equal(folder.materials[0].topics[0].attemptCount, 2);
});

test('deleteMaterial removes one material and its attempts while keeping sibling materials', () => {
  const folderId = saveMaterial({
    id: 'm-keep',
    title: 'Keep source',
    folderName: 'Shared folder',
    text: 'Keep text',
    topics: [{ id: 't-keep', title: 'Keep topic', summary: 'Keep summary.', keyPoints: [{ id: 'k-keep', text: 'Keep point.', importance: 2 }] }],
  });
  saveMaterial({
    id: 'm-drop',
    title: 'Drop source',
    folderId,
    text: 'Drop text',
    topics: [{ id: 't-drop', title: 'Drop topic', summary: 'Drop summary.', keyPoints: [{ id: 'k-drop', text: 'Drop point.', importance: 3 }] }],
  });
  saveAttempt({
    id: 'a-drop', topicId: 't-drop', answerText: 'Drop answer', score: 50,
    results: [{ id: 'r-drop', keyPointId: 'k-drop', status: 'partial', evidence: 'Drop answer' }], incorrectStatements: [],
  });

  assert.equal(deleteMaterial('m-drop'), true);
  assert.equal(deleteMaterial('m-drop'), false);
  assert.equal(materialExists('m-drop'), false);
  assert.equal(materialExists('m-keep'), true);
  assert.equal(getAttemptDetails('a-drop'), null);

  const folder = getFoldersWithTopics().find((item) => item.id === folderId);
  assert.equal(folder.materialCount, 1);
  assert.equal(folder.topicCount, 1);
  assert.equal(folder.materials[0].id, 'm-keep');
});
