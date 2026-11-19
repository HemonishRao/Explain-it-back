# Explain It Back

**Learn by explaining what you remember.** Explain It Back turns study material into a reusable topic checklist, then helps students practice recalling each topic without seeing the checklist first.

![Explain It Back home page](docs/screenshots/home.png)

**Live demo:** Not deployed yet. Add a verified demo URL here when one is available.

## What the app does

1. Paste study notes or upload a text-based PDF.
2. Generate topics and key-point checklists, grouped into study folders.
3. Explain a topic from memory by typing or using browser speech recognition where supported.
4. Review a weighted score, covered/partial/missed checklist items, evidence, and flagged incorrect statements.
5. Review generated keywords and flashcards for missed ideas, then try again.
6. Track scores and attempt history for each topic.

Topic checklists are extracted once when material is added and stay hidden on the Explain screen until an attempt is submitted. The backend computes scores from key-point status and importance; the LLM does not calculate the score.

## Local setup

### Requirements

- Node.js 20 or newer and npm
- A Gemini API key configured on the server (the app does not include a shared demo key)

Install dependencies and copy the environment template:

```sh
npm install
```

Windows PowerShell:

```powershell
Copy-Item server/.env.example server/.env
```

macOS or Linux:

```sh
cp server/.env.example server/.env
```

Set `GEMINI_API_KEY` in `server/.env`. Keep it there or in the server host's secret/environment settings. Never put it in `client/`, a `VITE_*` variable, source control, screenshots, or client-visible logs.

Start the development frontend and backend:

```sh
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`). The backend defaults to `http://localhost:5000`; Vite proxies `/api` requests to it. The API health endpoint is `/api/health`.

## Production setup

The simplest deployment is one Node.js service serving both the built frontend and API from the same origin. From the repository root, install dependencies, build, and start the server:

```sh
npm ci
npm run build
npm start
```

Configure these variables in the server environment. A host-provided environment variable takes precedence over the local `server/.env` file.

| Variable | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | Yes | Server-only Gemini credential. Never expose it to the browser. |
| `GEMINI_MODEL` | No | Gemini model name; defaults to `gemini-flash-latest`. |
| `PORT` | No | HTTP port supplied by the host; defaults to `5000`. |
| `DATABASE_PATH` | Required for durable data on ephemeral hosts | Absolute path to the SQLite database on persistent storage. Defaults to `server/explain-it-back.sqlite`. The directory must exist and be writable. |
| `CORS_ORIGIN` | Only for separate frontend hosting | Comma-separated exact frontend origins, such as `https://app.example.com`. Leave empty for same-origin hosting. |
| `VITE_API_URL` | Only for separate frontend hosting | Public API origin baked into the frontend at build time, such as `https://api.example.com`. It is not a secret. |

For a separately hosted frontend, copy `client/.env.example` to `client/.env.local` for local development, or set `VITE_API_URL` in the frontend build environment for production. Set the matching frontend origin in the backend's `CORS_ORIGIN`. Vite uses the local value as the `/api` proxy target. Use an origin only, without an `/api` path or trailing slash.

## SQLite and persistent storage

The app uses `better-sqlite3` and stores materials, generated topics, explanations, results, and study items in a local SQLite file. It uses WAL mode, which also creates `-wal` and `-shm` sidecar files beside the database.

On a hosting service with an ephemeral filesystem, this data can disappear when an instance restarts, is redeployed, or is replaced. Mount a persistent writable disk and point `DATABASE_PATH` to a file on that disk. Keep the database and its WAL/SHM files together on the same local filesystem. The database directory must exist before startup. Run a single app instance; this SQLite setup is not intended for multiple replicas sharing a network filesystem. Back up the database file with a SQLite-aware backup process while the app is active.

No database service or cloud storage is included or required by this repository.

## Demo walkthrough

Paste this into **Study material**:

> In operating systems, the CPU scheduler selects a process from the ready queue to run next. The dispatcher gives control of the CPU to the selected process. A context switch saves the state of the current process and restores the state of another process.

Create a folder, choose **Generate topics**, open a topic, and explain it from memory. For example:

> The CPU scheduler chooses which ready process runs next. The dispatcher hands the CPU to that process. During a context switch, the operating system saves the current process state and restores another process's state.

## Limitations and privacy

- There is no authentication or per-user data separation. Anyone who can reach a public instance can use its shared study library and may view its saved materials and learning history. Do not submit private material to a public demo.
- Study material, explanations, and content needed for grading or study aids are sent to Gemini through the server. Configure a key and model you control; usage limits or charges depend on the Google account and current API terms. A public instance can let visitors consume the configured key's quota.
- Pasted material is limited to 50,000 characters; explanations to 5,000 characters; PDF uploads to 10 MB.
- PDF uploads must contain selectable text. Scanned image PDFs are not supported.
- The app is designed for theory-heavy subjects. Math-heavy and code-heavy material may be harder to assess reliably.
- Browser speech recognition availability and behavior depend on the browser and may require microphone permission.

## Built with

React, Vite, React Router, Recharts, Node.js, Express, SQLite (`better-sqlite3`), Zod, and the Gemini API.

## License

No license has been added to this repository yet.
