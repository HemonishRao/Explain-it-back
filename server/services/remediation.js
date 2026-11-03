import { randomUUID } from 'node:crypto';
import { buildRemediationUser, LLM_SETTINGS, REMEDIATION_SYSTEM } from '../prompts.js';
import { getAttemptDetails, getStudyItems, getWeakPointsForAttempt, saveStudyItems } from '../db.js';
import { callLlm } from './llm.js';
import { parseLlmJson } from './llm-json.js';
import { remediationResponseSchema } from '../schemas.js';

export async function generateStudyItems(attemptId, llmCall = callLlm) {
  const details = getAttemptDetails(attemptId);
  if (!details) {
    const error = new Error('Attempt not found.');
    error.status = 404;
    throw error;
  }
  const saved = getStudyItems(attemptId);
  if (saved.length) return { attemptId, topicId: details.attempt.topicId, items: saved };
  const weakPoints = getWeakPointsForAttempt(attemptId);
  if (!weakPoints.length) return { attemptId, topicId: details.attempt.topicId, items: [] };

  let remediation;
  let lastValidationError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const output = await llmCall({
      system: REMEDIATION_SYSTEM,
      user: buildRemediationUser(details.attempt.topicTitle, weakPoints),
      temperature: LLM_SETTINGS.remediation.temperature,
    });
    try {
      remediation = remediationResponseSchema.parse(parseLlmJson(output));
      const expectedIds = weakPoints.map((point) => point.id);
      const receivedIds = remediation.items.map((item) => item.keyPointId);
      if (receivedIds.length !== expectedIds.length || receivedIds.some((id, index) => id !== expectedIds[index])) {
        throw new Error('Study items did not match the missed checklist points.');
      }
      break;
    } catch (error) {
      lastValidationError = error;
      remediation = null;
    }
  }
  if (!remediation) {
    const error = new Error('Study aids could not be generated reliably. Please try again.');
    error.status = 502;
    error.cause = lastValidationError;
    throw error;
  }

  saveStudyItems(attemptId, remediation.items.map((item) => ({ ...item, id: randomUUID() })));
  return { attemptId, topicId: details.attempt.topicId, items: getStudyItems(attemptId) };
}
