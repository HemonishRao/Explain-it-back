const apiUrl = (import.meta.env?.VITE_API_URL || '').replace(/\/+$/, '');
const studyRequestsByAttempt = new Map();

async function requestJson(url, options, fallbackError) {
  const response = await fetch(`${apiUrl}${url}`, options);
  const rawBody = await response.text();
  let data = null;
  if (rawBody) {
    try {
      data = JSON.parse(rawBody);
    } catch {
      if (response.ok) throw new Error(fallbackError);
    }
  }
  if (!response.ok) throw new Error(data?.error || fallbackError);
  if (data === null) throw new Error(fallbackError);
  return data;
}

export async function createMaterial({ title, text, file, folderId, folderName }) {
  const options = file
    ? (() => {
      const body = new FormData();
      body.append('file', file);
      if (title) body.append('title', title);
      if (folderId) body.append('folderId', folderId);
      if (folderName) body.append('folderName', folderName);
      return { method: 'POST', body };
    })()
    : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, text, folderId, folderName }) };
  return requestJson('/api/materials', options, 'Could not generate topics.');
}

export async function getFolders() {
  const data = await requestJson('/api/folders', undefined, 'Could not load folders.');
  return data.folders;
}

export async function removeFolder(folderId) {
  return requestJson(`/api/folders/${encodeURIComponent(folderId)}`, { method: 'DELETE' }, 'Could not delete this folder.');
}

export async function removeMaterial(materialId) {
  return requestJson(`/api/materials/${encodeURIComponent(materialId)}`, { method: 'DELETE' }, 'Could not delete this source material.');
}

export async function getMaterialTopics(materialId) {
  const data = await requestJson(`/api/materials/${encodeURIComponent(materialId)}/topics`, undefined, 'Could not load topics.');
  return data.topics;
}

export async function getTopic(topicId) {
  const data = await requestJson(`/api/topics/${encodeURIComponent(topicId)}`, undefined, 'Could not load this topic.');
  return data.topic;
}

export async function getTopicHint(topicId, explanationSoFar = '') {
  return requestJson(
    `/api/topics/${encodeURIComponent(topicId)}/hint`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ explanationSoFar }),
    },
    'Could not get a hint right now.',
  );
}

export async function submitExplanation(topicId, answerText) {
  return requestJson(
    `/api/topics/${encodeURIComponent(topicId)}/attempts`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answerText }),
    },
    'Could not grade this explanation.',
  );
}

export async function getAttempt(attemptId) {
  return requestJson(`/api/attempts/${encodeURIComponent(attemptId)}`, undefined, 'Could not load these results.');
}

export function createStudyItems(attemptId) {
  const pendingRequest = studyRequestsByAttempt.get(attemptId);
  if (pendingRequest) return pendingRequest;

  const request = requestJson(`/api/attempts/${encodeURIComponent(attemptId)}/study`, { method: 'POST' }, 'Could not create study aids.');
  studyRequestsByAttempt.set(attemptId, request);
  const clearRequest = () => {
    if (studyRequestsByAttempt.get(attemptId) === request) studyRequestsByAttempt.delete(attemptId);
  };
  request.then(clearRequest, clearRequest);
  return request;
}

export async function getTopicAttempts(topicId) {
  return requestJson(`/api/topics/${encodeURIComponent(topicId)}/attempts`, undefined, 'Could not load this topic’s progress.');
}
