import { randomUUID } from 'node:crypto';
import { LLM_SETTINGS, buildTopicExtractionUser, buildTopicMergeUser, TOPIC_EXTRACTION_SYSTEM, TOPIC_MERGE_SYSTEM } from '../prompts.js';
import { topicExtractionSchema } from '../schemas.js';
import { callLlm } from './llm.js';
import { parseLlmJson } from './llm-json.js';
import { splitMaterialIntoChunks } from './chunking.js';

function assignStoredIds(topics) {
  return topics.map((topic) => ({
    ...topic,
    id: randomUUID(),
    keyPoints: topic.keyPoints.map((point) => ({ ...point, id: randomUUID() })),
  }));
}

function renumberTopicsForMerge(topics) {
  let nextPointIndex = 1;
  return topics.map((topic, topicIndex) => ({
    ...topic,
    id: `t${topicIndex + 1}`,
    keyPoints: topic.keyPoints.map((point) => ({ ...point, id: `k${nextPointIndex++}` })),
  }));
}

async function extractTopicsFromChunk(materialText, llmCall) {
  let lastValidationError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const output = await llmCall({
      system: TOPIC_EXTRACTION_SYSTEM,
      user: buildTopicExtractionUser(materialText),
      temperature: LLM_SETTINGS.extraction.temperature,
    });
    try {
      return topicExtractionSchema.parse(parseLlmJson(output)).topics;
    } catch (error) { lastValidationError = error; }
  }
  const error = new Error('The AI returned topics in an unexpected format. Please try again.');
  error.status = 502;
  error.cause = lastValidationError;
  throw error;
}

async function mergeExtractedTopics(topics, llmCall) {
  const normalizedTopics = renumberTopicsForMerge(topics);
  let lastValidationError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const output = await llmCall({
      system: TOPIC_MERGE_SYSTEM,
      user: buildTopicMergeUser(normalizedTopics),
      temperature: LLM_SETTINGS.merge.temperature,
    });
    try {
      return topicExtractionSchema.parse(parseLlmJson(output)).topics;
    } catch (error) { lastValidationError = error; }
  }
  const error = new Error('The AI could not combine topics from this long material. Please try again.');
  error.status = 502;
  error.cause = lastValidationError;
  throw error;
}

export async function extractTopics(materialText, llmCall = callLlm) {
  if (materialText.length < 4_000) {
    return assignStoredIds(await extractTopicsFromChunk(materialText, llmCall));
  }
  const chunks = splitMaterialIntoChunks(materialText);
  const extractedTopics = [];
  for (const chunk of chunks) extractedTopics.push(...await extractTopicsFromChunk(chunk, llmCall));
  if (extractedTopics.length <= 1) return assignStoredIds(extractedTopics);
  return assignStoredIds(await mergeExtractedTopics(extractedTopics, llmCall));
}
