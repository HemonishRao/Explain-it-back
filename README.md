# Explain It Back

Explain It Back helps students learn by recalling and explaining study material. Add pasted text or a text-based PDF, review the generated topics, explain a topic from memory, and get a weighted checklist score with targeted study aids and progress history.

The project implements the complete seven-step plan, including optional browser speech input. Key points stay hidden from the Explain screen until an explanation is submitted. The backend computes scores from the checklist; the LLM does not return a score.

## Contents

- [Requirements](#requirements)
- [Setup](#setup)
- [Run in development](#run-in-development)
- [Use the app](#use-the-app)
- [Build and run](#build-and-run)
- [Run checks](#run-checks)
- [API routes](#api-routes)
- [Limits and behavior](#limits-and-behavior)
- [Troubleshooting](#troubleshooting)
- [Project structure](#project-structure)

## Requirements

- Node.js 20 or newer
- npm
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)
- A modern browser; voice input requires browser support for the Web Speech API and microphone permission

## Setup

Run these commands from the project root:

```powershell
npm install
Copy-Item server/.env.example server/.env
```

On macOS/Linux, use `cp server/.env.example server/.env` for the second command.

Edit `server/.env` and set `GEMINI_API_KEY` to your key. Keep this file private and do not commit it. The repository ignores environment files while keeping `server/.env.example` available as a template.

Available server settings:

| Variable | Purpose | Default |
| --- | --- | --- |
| `GEMINI_API_KEY` | Required key used by the server to call Gemini | None |
| `GEMINI_MODEL` | Optional Gemini model name | `gemini-flash-latest` |
| `PORT` | Port for the Express API and production server | `5000` |
| `VITE_API_URL` | Optional API target for Vite's `/api` development proxy | `http://localhost:5000` |

The API reads `server/.env`. Do not put provider keys in `client/` or in `VITE_` variables. `VITE_API_URL` is only a server address, not a secret.

## Run in development

Start both the API and the Vite development server:

```sh
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`). The API listens on port 5000 by default. Check that it is responding at `http://localhost:5000/api/health`; it should return:

```json
{"status":"ok"}
```

To run each process separately, use two terminals in the project root:

```sh
npm run dev:server
```

```sh
npm run dev:client
```

## Use the app

1. On the home page, enter a material name if you want one, then choose an existing folder or enter a name to create a folder.
2. Paste notes into **Study material**, or choose a text-based PDF (10 MB maximum). Pasting text clears the selected file, and choosing a file clears pasted text.
3. Select **Generate topics** and wait while the app reads the material. The generated topic cards appear in the folder library.
4. Select **Explain this topic**. The screen shows the topic title and summary, but not its key-point checklist.
5. Explain the topic from memory in your own words. Type up to 5,000 characters, or use **Start voice input** if supported. Submit the explanation for grading.
6. Review the weighted score, covered/partial/missed checklist, supporting evidence, and any incorrect statements.
7. Select **Study missed points** to review keywords and flashcards for missed or partial points. Flip a card to reveal its answer. Choose **Re-explain topic** to try again.
8. Use **View progress** on a topic or attempt to review previous scores.
9. Use the folder page to add more source material to a folder. **Delete folder** removes that folder's source materials, topics, and learning history.

### Sample material and explanation

For a quick demo, paste this as study material:

> In operating systems, the CPU scheduler selects a process from the ready queue to run next. The dispatcher gives control of the CPU to the selected process. A context switch saves the state of the current process and restores the state of another process.

For the explanation, try:

> The CPU scheduler chooses which ready process runs next. The dispatcher hands the CPU to that process. During a context switch, the operating system saves the current process state and restores another process's state.

## Build and run

Create a production frontend bundle:

```sh
npm run build
```

Start the Express server:

```sh
npm start
```

The server serves the built app and API on the configured `PORT` (5000 by default). Build the frontend again after frontend changes. Keep `server/.env` available on the machine running the server.

## Run checks

Run the project's automated test suite:

```sh
npm test
```

The suite includes checks for extraction, chunking, PDF handling, input schemas, grading validation, weighted scoring, database behavior, timeouts, and speech helpers. Use `npm run build` to check that the frontend production bundle compiles.

## API routes

All routes are prefixed with `/api`.

| Method and route | Purpose |
| --- | --- |
| `GET /api/health` | Health check |
| `GET /api/folders` | List folders, source materials, topics, and latest topic scores |
| `DELETE /api/folders/:id` | Delete a folder and its related data |
| `POST /api/materials` | Create material and extract/store topics; accepts JSON text or multipart PDF upload |
| `GET /api/materials/:id/topics` | Get topic titles and summaries for a material |
| `GET /api/topics/:id` | Get a topic title and summary for the Explain screen |
| `POST /api/topics/:topicId/attempts` | Submit `{ "answerText": "..." }`, grade it, and return the attempt ID and computed score |
| `GET /api/attempts/:id` | Get results, checklist details, evidence, and incorrect statements for an attempt |
| `POST /api/attempts/:id/study` | Generate or retrieve keywords and flashcards for points to revisit |
| `GET /api/topics/:topicId/attempts` | Get a topic's attempt history for progress tracking |

Example text request:

```http
POST /api/materials
Content-Type: application/json
```

```json
{
  "title": "Operating Systems Notes",
  "text": "The CPU scheduler selects a process from the ready queue...",
  "folderName": "Operating Systems"
}
```

For PDF requests, send `multipart/form-data` with a `file` field and optional `title`, `folderId`, or `folderName` fields. API errors use a JSON response such as `{ "error": "Please choose a PDF file." }`.

## Limits and behavior

- Pasted or extracted material: at most 50,000 characters.
- Explanation: at most 5,000 characters.
- PDF: one text-based PDF up to 10 MB. Scanned PDFs without an embedded text layer are not supported.
- Material over about 4,000 characters is split into overlapping chunks, processed, then merged. Shorter material skips chunking and merging.
- Extracted topics and checklist points are saved once when the material is added. Attempts use that saved checklist.
- Score formula: `sum(statusValue * importance) / sum(importance) * 100`, where covered = 1, partial = 0.5, and missed = 0.
- Voice input depends on the browser's Web Speech API. If unavailable or permission is denied, type the explanation instead.
- The app works best with theory-heavy material. Math-heavy or code-heavy explanations may be difficult to assess reliably.

SQLite data is stored in `server/explain-it-back.sqlite` and is created by the server as needed. The database and its WAL files are local runtime data; keep them out of version control if they contain personal study material.

## Troubleshooting

- **The server reports an LLM setup or request error:** confirm `server/.env` exists and `GEMINI_API_KEY` is set correctly. Restart the server after changing environment settings.
- **The browser cannot reach the API:** confirm the server is running and `GET http://localhost:5000/api/health` returns `{"status":"ok"}`. If you changed the API port, set `VITE_API_URL` for the Vite proxy and restart Vite.
- **A PDF is rejected or produces no topics:** use a valid, text-based PDF with selectable text. Scanned image PDFs need OCR, which is outside the current scope.
- **Voice input is missing:** use a supported browser, allow microphone access, and use a secure browser context when required by the browser.
- **The browser reports oversized material:** keep material under 50,000 characters and PDFs under 10 MB.

## Project structure

```text
client/
  src/
    api/       Browser API calls
    pages/     Progress screen
    App.jsx    Upload, explain, results, and study flows
server/
  routes/      Express API routes
  services/    Extraction, chunking, grading, PDF, and study-aid logic
  db.js        SQLite persistence
  prompts.js   LLM prompts and model settings
  .env.example Server configuration template
tests/         Automated Node.js tests
explain-it-back-plan.md
```
