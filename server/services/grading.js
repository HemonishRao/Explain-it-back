import { randomUUID } from 'node:crypto';
import { buildGradingRetryUser, buildGradingUser, GRADING_SYSTEM, LLM_SETTINGS } from '../prompts.js';
import { getTopicForExplain, getTopicKeyPoints, saveAttempt } from '../db.js';
import { validateGradeResponse } from './grading-validation.js';
import { calculateScore } from './scoring.js';
import { callLlm } from './llm.js';

export async function gradeExplanation(topicId, answerText, llmCall = callLlm) {
  const topic = getTopicForExplain(topicId);
  if (!topic) {
    const error = new Error('Topic not found.');
    error.status = 404;
    throw error;
  }
  const keyPoints = getTopicKeyPoints(topicId);
  if (!keyPoints.length) throw new Error('This topic does not have a saved checklist.');

  let grade;
  if (!answerText.trim()) {
    grade = { results: keyPoints.map((point) => ({ keyPointId: point.id, status: 'missed', evidence: '' })), incorrectStatements: [] };
  } else {
    let lastValidationError;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const output = await llmCall({
        system: GRADING_SYSTEM,
        user: attempt === 0
          ? buildGradingUser(topic.title, keyPoints, answerText)
          : buildGradingRetryUser(topic.title, keyPoints, answerText),
        temperature: LLM_SETTINGS.grading.temperature,
      });
      try {
        grade = validateGradeResponse(output, keyPoints, answerText);
        break;
      } catch (error) {
        lastValidationError = error;
      }
    }
    if (!grade) {
      const error = new Error('The AI could not grade this explanation reliably. Please try again.');
      error.status = 502;
      error.cause = lastValidationError;
      throw error;
    }
  }

  const score = calculateScore(grade.results, keyPoints);
  const attemptId = randomUUID();
  saveAttempt({
    id: attemptId,
    topicId,
    answerText,
    score,
    results: grade.results.map((result) => ({ ...result, id: randomUUID() })),
    incorrectStatements: grade.incorrectStatements.map((statement) => ({ ...statement, id: randomUUID() })),
  });
  return { attemptId, score };
}
