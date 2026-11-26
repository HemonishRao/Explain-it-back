import { buildHintUser, HINT_SYSTEM, LLM_SETTINGS } from '../prompts.js';
import { getTopicForExplain, getTopicKeyPoints } from '../db.js';
import { hintResponseSchema } from '../schemas.js';
import { callLlm } from './llm.js';
import { parseLlmJson } from './llm-json.js';

function pickHintKeyPoint(keyPoints, explanationSoFar) {
  const normalized = explanationSoFar.toLowerCase();
  const sorted = [...keyPoints].sort((a, b) => b.importance - a.importance);
  if (!normalized.trim()) return sorted[0];

  const unaddressed = sorted.find((point) => {
    const keywords = point.text.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || [];
    if (!keywords.length) return true;
    const matched = keywords.filter((word) => normalized.includes(word)).length;
    return matched / keywords.length < 0.5;
  });
  return unaddressed || sorted[0];
}

export async function generateTopicHint(topicId, explanationSoFar = '', llmCall = callLlm) {
  const topic = getTopicForExplain(topicId);
  if (!topic) {
    const error = new Error('Topic not found.');
    error.status = 404;
    throw error;
  }
  const keyPoints = getTopicKeyPoints(topicId);
  if (!keyPoints.length) {
    const error = new Error('This topic does not have a saved checklist.');
    error.status = 400;
    throw error;
  }

  const targetPoint = pickHintKeyPoint(keyPoints, explanationSoFar);
  let lastValidationError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const output = await llmCall({
      system: HINT_SYSTEM,
      user: buildHintUser(topic.title, targetPoint, explanationSoFar),
      temperature: LLM_SETTINGS.hint.temperature,
    });
    try {
      const { hint } = hintResponseSchema.parse(parseLlmJson(output));
      return { hint };
    } catch (error) {
      lastValidationError = error;
    }
  }

  const error = new Error('Could not generate a hint right now. Please try again.');
  error.status = 502;
  error.cause = lastValidationError;
  throw error;
}
