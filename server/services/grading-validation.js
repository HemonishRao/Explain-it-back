import { gradingResponseSchema } from '../schemas.js';
import { parseLlmJson } from './llm-json.js';

export function validateGradeResponse(output, keyPoints, answerText) {
  const grade = gradingResponseSchema.parse(parseLlmJson(output));
  const expectedIds = keyPoints.map((point) => point.id);
  const receivedIds = grade.results.map((result) => result.keyPointId);
  if (receivedIds.length !== expectedIds.length || receivedIds.some((id, index) => id !== expectedIds[index])) {
    throw new Error('Grading result did not match the checklist.');
  }
  if (new Set(receivedIds).size !== receivedIds.length) throw new Error('Grading result contains duplicate checklist ids.');

  for (const result of grade.results) {
    if (result.status === 'missed') {
      if (result.evidence !== '') throw new Error('Missed checklist items must have empty evidence.');
    } else {
      const evidence = findExactQuote(answerText, result.evidence);
      if (!evidence) throw new Error('Grading evidence must be a short exact quote from the explanation.');
      result.evidence = evidence;
    }
  }
  for (const statement of grade.incorrectStatements) {
    const userSaid = findExactQuote(answerText, statement.userSaid);
    if (!userSaid) throw new Error('Incorrect statements must quote the explanation exactly.');
    statement.userSaid = userSaid;
  }
  return grade;
}

function getWords(value) {
  return [...value.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)].map((match) => ({
    value: match[0].normalize('NFKC').replaceAll('’', "'").toLocaleLowerCase(),
    start: match.index,
    end: match.index + match[0].length,
  }));
}

function findExactQuote(source, quote) {
  const sourceWords = getWords(source);
  const quoteWords = getWords(quote);
  if (!quoteWords.length || quoteWords.length > 25 || quoteWords.length > sourceWords.length) return null;

  for (let start = 0; start <= sourceWords.length - quoteWords.length; start += 1) {
    const matches = quoteWords.every((word, offset) => word.value === sourceWords[start + offset].value);
    if (matches) {
      return source.slice(sourceWords[start].start, sourceWords[start + quoteWords.length - 1].end);
    }
  }
  return null;
}
