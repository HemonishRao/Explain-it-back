// server/services/llm.js
// Single place where the Gemini API is called. Nothing else in the app talks to Gemini.
// Install: npm i @google/genai dotenv
// Env: GEMINI_API_KEY (required), GEMINI_MODEL (optional)

import '../config.js';
import { GoogleGenAI } from '@google/genai';

const API_KEY = process.env.GEMINI_API_KEY;

// Model names change often. Set GEMINI_MODEL in .env to a current Flash model
// shown in Google AI Studio. The default is an alias that follows the latest Flash.
const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';

const MAX_RETRIES = 3; // for rate limits / temporary server errors
const TIMEOUT_MS = 60000;

if (!API_KEY) {
  console.warn('[llm] GEMINI_API_KEY is missing. Add it to server/.env');
}

const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Errors worth retrying: rate limit (429), overloaded/unavailable (503, 500)
export function isDailyQuotaError(err) {
  const message = String(err?.message || '').toLowerCase();
  return message.includes('per day')
    || message.includes('daily quota')
    || message.includes('daily limit')
    || message.includes('quota exceeded');
}

export function isRetryable(err) {
  if (err?.code === 'LLM_TIMEOUT' || (Number(err?.status ?? err?.code) === 429 && isDailyQuotaError(err))) return false;
  const status = err?.status ?? err?.code;
  if ([429, 500, 503, 504].includes(Number(status))) return true;
  const msg = String(err?.message || '').toLowerCase();
  return msg.includes('overloaded') || msg.includes('unavailable') || msg.includes('rate');
}

export function withTimeout(operation, ms) {
  const controller = new AbortController();
  const timeoutError = new Error('LLM request timed out');
  timeoutError.status = 504;
  timeoutError.code = 'LLM_TIMEOUT';
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(timeoutError);
    }, ms);
  });
  const request = Promise.resolve()
    .then(() => operation(controller.signal))
    .catch((error) => {
      if (controller.signal.aborted) throw timeoutError;
      throw error;
    });
  return Promise.race([request, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Calls Gemini and returns the raw response text (expected to be JSON).
 * Validation happens afterwards with callWithValidation() from schemas.js.
 *
 * @param {object} opts
 * @param {string} opts.system       System instruction (from prompts.js)
 * @param {string} opts.user         User message (from prompts.js builders)
 * @param {number} [opts.temperature]
 * @returns {Promise<string>}
 */
export async function callLlm({ system, user, temperature = 0.2 }) {
  if (!ai) {
    const error = new Error('The AI service is not configured. Add GEMINI_API_KEY to server/.env.');
    error.status = 503;
    throw error;
  }
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await withTimeout(
        (abortSignal) => ai.models.generateContent({
          model: MODEL,
          contents: user,
          config: {
            systemInstruction: system,
            temperature,
            responseMimeType: 'application/json', // forces JSON output
            maxOutputTokens: 8192, // generous; thinking tokens may count toward this
            abortSignal,
          },
        }),
        TIMEOUT_MS
      );

      const text = response?.text;
      if (!text || !text.trim()) {
        throw new Error('Gemini returned an empty response');
      }
      return text;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES && isRetryable(err)) {
        const delay = 1000 * 2 ** attempt + Math.random() * 500; // 1s, 2s, 4s + jitter
        console.warn(`[llm] retry ${attempt + 1}/${MAX_RETRIES} in ${Math.round(delay)}ms`);
        await sleep(delay);
        continue;
      }
      break;
    }
  }

  // Log details on the server only. Never send raw LLM errors to the client.
  console.error('[llm] request failed:', lastError?.message);

  const status = Number(lastError?.status ?? lastError?.code);
  if (status === 429) {
    const message = isDailyQuotaError(lastError)
      ? 'Gemini daily free-tier request limit reached. Check your AI Studio quota or retry after the reset.'
      : 'The AI service is busy right now. Please try again in a minute.';
    const e = new Error(message);
    e.status = 429;
    throw e;
  }
  if ([401, 403, 404].includes(status)) {
    const e = new Error('Gemini rejected the server API key or model setting. Check server/.env.');
    e.status = 503;
    throw e;
  }
  if (status === 504 || lastError?.message === 'LLM request timed out') {
    const e = new Error('Gemini did not respond in time. Please retry in a moment.');
    e.status = 504;
    throw e;
  }
  const e = new Error('The AI service could not complete the request. Please try again.');
  e.status = 502;
  throw e;
}
