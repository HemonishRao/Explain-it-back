const apiUrl = import.meta.env.VITE_API_URL || '';
const studyRequestsByAttempt = new Map();

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
  const response = await fetch(`${apiUrl}/api/materials`, {
    ...options,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not generate topics.');
  return data;
}

export async function getFolders() {
  const response = await fetch(`${apiUrl}/api/folders`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not load folders.');
  return data.folders;
}

export async function removeFolder(folderId) {
  const response = await fetch(`${apiUrl}/api/folders/${encodeURIComponent(folderId)}`, { method: 'DELETE' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not delete this folder.');
  return data;
}

export async function getTopic(topicId) {
  const response = await fetch(`${apiUrl}/api/topics/${encodeURIComponent(topicId)}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not load this topic.');
  return data.topic;
}

export async function submitExplanation(topicId, answerText) {
  const response = await fetch(`${apiUrl}/api/topics/${encodeURIComponent(topicId)}/attempts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answerText }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not grade this explanation.');
  return data;
}

export async function getAttempt(attemptId) {
  const response = await fetch(`${apiUrl}/api/attempts/${encodeURIComponent(attemptId)}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not load these results.');
  return data;
}

export function createStudyItems(attemptId) {
  const pendingRequest = studyRequestsByAttempt.get(attemptId);
  if (pendingRequest) return pendingRequest;

  const request = (async () => {
    const response = await fetch(`${apiUrl}/api/attempts/${encodeURIComponent(attemptId)}/study`, { method: 'POST' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not create study aids.');
    return data;
  })();
  studyRequestsByAttempt.set(attemptId, request);
  const clearRequest = () => {
    if (studyRequestsByAttempt.get(attemptId) === request) studyRequestsByAttempt.delete(attemptId);
  };
  request.then(clearRequest, clearRequest);
  return request;
}

export async function getTopicAttempts(topicId) {
  const response = await fetch(`${apiUrl}/api/topics/${encodeURIComponent(topicId)}/attempts`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not load this topic’s progress.');
  return data;
}
