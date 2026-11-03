# Explain It Back

Steps 1-7 of the project plan are implemented: paste or upload study material, generate topics, explain a topic from memory by typing or optional voice input, review a weighted score and study aids, and track progress. The browser receives only topic titles and summaries before submission; checklist details are returned only after grading.

## Requirements

- Node.js 20 or newer
- npm
- A Gemini API key from Google AI Studio

## Setup and run

```sh
npm install
Copy-Item server/.env.example server/.env
```

Add your `GEMINI_API_KEY` to `server/.env`, then run:

```sh
npm run dev
```

Open the Vite URL printed in the terminal. The API listens on port 5000 by default. For a production frontend bundle, run `npm run build`; start the API with `npm start`.

Run the automated checks with `npm test`. The suite covers input limits, LLM response validation and retry behavior, weighted scoring, SQLite persistence, and attempt results.

## Step 1 API

- `POST /api/materials` — JSON body `{ "title": "Optional title", "text": "Study material..." }`; responds with `materialId` and topics containing only `id`, `title`, and `summary`.
- `POST /api/materials` — multipart form with optional `title` and a PDF `file`; text is extracted on the server before topic generation.
- `GET /api/materials/:id/topics` — returns the saved topic titles and summaries.
- `GET /api/health` — API health check.

Material text, including extracted PDF text, is limited to 50,000 characters. PDF uploads are limited to 10 MB and must contain readable text. Materials longer than 4,000 characters are split into overlapping chunks, extracted individually, then merged once. Extracted topics and key points are stored in `server/explain-it-back.sqlite`.

## Step 2 API

- `GET /api/topics/:id` — returns the topic title and summary only.
- `POST /api/topics/:id/attempts` — JSON body `{ "answerText": "Your explanation..." }`; returns `{ "attemptId": "...", "score": 82.5 }`.
- `GET /api/attempts/:id` — returns the saved score, checklist statuses and evidence, and incorrect statements for a submitted attempt.
- `GET /api/topics/:id/attempts` — returns the topic and its scores in chronological order for the progress chart.

Explanations are limited to 5,000 characters. The score is computed by the backend using the checklist importance weights. Empty explanations are saved with a score of zero. The results screen is available at `/attempts/:id/results` after submission.

On supported browsers, select **Start voice input** on the Explain screen, allow microphone access, and select **Stop voice input** when done. The recognized words are added to the explanation text and share its 5,000-character limit. Typing remains available if speech recognition is not supported or microphone access is unavailable.

Demo: generate topics from study material, open one topic, then explain it in your own words. For example, if studying process scheduling, write: “The CPU scheduler chooses which ready process runs next. The dispatcher gives control of the CPU to that process.”
