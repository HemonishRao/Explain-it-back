# Explain It Back: Project Plan

A web app where students upload study material, the app extracts topics using an LLM, and the student explains each topic back (typed or spoken). The app grades the explanation against the source, shows what was missed, and generates keywords and flashcards for the gaps. Based on the Feynman technique.

---

## 1. Core Loop

1. User uploads or pastes study material
2. LLM extracts topics, each with 5-8 key points (done once, stored)
3. User picks a topic and explains it (typing, or voice later)
4. LLM checks the explanation against the stored key points
5. App shows a weighted score, covered/partial/missed points, and incorrect statements
6. App generates keywords and flashcards for missed/partial points only
7. User re-explains and sees their score improve over time

## 2. Scope

**v1 inputs:** pasted text, .txt, text-based PDFs
**v2 (stretch):** .pptx, YouTube transcripts
**Out of scope (future work):** scanned/handwritten notes (needs OCR)

**Known limitation:** works best for theory-heavy subjects (history, biology, OS concepts). Math and code are hard to grade by explanation.

## 3. Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React (Vite), React Router, Recharts |
| Voice input | Web Speech API (browser built-in, stretch) |
| Backend | Node + Express |
| LLM | Gemini (free tier) or Claude API |
| PDF parsing | `pdf-parse` |
| Database | SQLite (simple) or MongoDB |
| Validation | Zod (validate all LLM JSON output) |

## 4. Key Design Decisions

- **Extract key points once at upload, store them.** Every attempt is graded against the same fixed checklist, so scores are consistent and comparable.
- **Score computed in code, not by the LLM.** covered = 1, partial = 0.5, missed = 0, weighted by importance (1-3).
- **Grading temperature = 0** for consistency.
- **Evidence field** forces the LLM to quote the user's answer for each "covered" mark, reducing false positives.
- **Key points hidden on the Explain screen**, revealed only after submission. This is the heart of the method.
- **Long material:** chunk text, extract topics per chunk, merge duplicates.
- **Incorrect statements** are flagged separately from missing ones.

## 5. Data Contracts

### Topic extraction output

```json
{
  "topics": [
    {
      "id": "t1",
      "title": "Process Scheduling",
      "summary": "One-line description",
      "keyPoints": [
        { "id": "k1", "text": "CPU scheduling decides which process runs next", "importance": 3 }
      ]
    }
  ]
}
```

### Grading output

```json
{
  "results": [
    { "keyPointId": "k1", "status": "covered | partial | missed", "evidence": "quote from user's answer" }
  ],
  "incorrectStatements": [
    { "userSaid": "...", "correction": "..." }
  ]
}
```

### Remediation output

```json
{
  "items": [
    {
      "keyPointId": "k1",
      "keywords": ["scheduler", "ready queue", "dispatcher"],
      "flashcards": [
        { "front": "What does the CPU scheduler do?", "back": "Chooses which ready process runs next." }
      ]
    }
  ]
}
```

### Score formula

```
score = sum(statusValue * importance) / sum(importance) * 100
statusValue: covered = 1, partial = 0.5, missed = 0
```

## 6. Prompts (keep in a separate `prompts.js` file)

**Topic extraction:** Extract the main topics from the text. For each, give a title, a one-line summary, and 5-8 key points with importance 1-3. Return JSON only, matching the schema.

**Grading:** You are a strict but fair tutor. Given the key point checklist and the student's explanation:
- Mark "covered" only if the idea is present (wording can differ)
- Mark "partial" if vague or incomplete
- Mark "missed" if absent
- Judge only against the checklist, not outside knowledge
- Quote evidence from the student's answer for each covered/partial point
- List factually wrong statements with corrections
- Return JSON only

**Remediation:** For each missed/partial key point, give 3-5 keywords and 2-3 flashcards (front/back). Return JSON only.

## 7. Screens

| # | Screen | Route | Contents |
|---|---|---|---|
| 1 | Upload / Paste | `/` | Text box, file drop zone, folder picker or new-folder field, grouped folder library, add-source and delete-folder actions |
| 2 | Topic List | `/topics` | Card per topic: title, summary, last score or "Not attempted" |
| 3 | Explain | `/topics/:id/explain` | Topic title only, large text area, mic button, Submit, optional Hint (small penalty) |
| 4 | Results | `/attempts/:id/results` | Weighted score, checklist (covered/partial/missed with evidence), incorrect statements box, "Study missed points" and "Try again" |
| 5 | Study | `/topics/:id/study` | Keyword chips, flip flashcards with "Got it / Review again", "Re-explain" CTA |
| 6 | Progress | `/topics/:id/progress` | Line chart of scores per attempt, overall mastery |

## 8. Database Schema

```
folders(id, name, created_at)
materials(id, folder_id, title, raw_text, created_at)
topics(id, material_id, title, summary)
key_points(id, topic_id, text, importance)
attempts(id, topic_id, answer_text, score, created_at)
attempt_results(id, attempt_id, key_point_id, status, evidence)
incorrect_statements(id, attempt_id, user_said, correction)
study_items(id, attempt_id, key_point_id, keywords_json, flashcards_json)
```

## 9. Backend API Routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/folders` | List folders, their source materials, and their topics |
| DELETE | `/api/folders/:id` | Delete a folder and its materials, topics, and learning history |
| POST | `/api/materials` | Accept text or file (multer), parse PDF, chunk, extract topics via LLM, and save into a new or selected folder |
| GET | `/api/materials/:id/topics` | List topics with latest score |
| GET | `/api/topics/:id` | Topic details (title, summary only; key points withheld) |
| POST | `/api/topics/:id/attempts` | Body: `{ answerText }`. Grades via LLM, computes score, stores results, returns attempt id |
| GET | `/api/attempts/:id` | Full results: score, per-point status, evidence, incorrect statements (key points revealed here) |
| POST | `/api/attempts/:id/study` | Generate and store keywords and flashcards for missed/partial points |
| GET | `/api/topics/:id/attempts` | Attempt history for the progress chart |
| GET | `/api/topics/:id/hint` | Return one keyword from an unaddressed key point (stretch) |

**Backend structure**

```
server/
  index.js
  routes/        (materials.js, topics.js, attempts.js)
  services/      (llm.js, grading.js, chunking.js, pdf.js)
  prompts.js
  schemas.js     (Zod schemas)
  db.js
```

**Backend rules**
- Validate every LLM response with Zod; retry once on invalid JSON
- Never send key points to the client before an attempt is submitted
- Cap input size (e.g. 50k characters) and show a clear error
- Keep the API key in `.env`, never in the frontend

## 10. Build Order (each step is demoable)

1. Paste text, LLM returns topics with key points (JSON)
2. Type an explanation, LLM grades it, code computes score
3. Results screen with checklist and incorrect statements
4. Keywords and flashcards for missed points
5. Attempt history and progress chart
6. PDF upload and chunking for long material
7. Voice input via Web Speech API (stretch)

## 11. Testing Plan

Write 4 sample explanations for one topic and check scores behave sensibly:
- **Strong** answer should score 80%+
- **Vague** answer should score 30-50%
- **Wrong** answer should show incorrect statements flagged
- **Off-topic** answer should score near 0%

Also test: empty input, very long material, malformed LLM JSON, duplicate topics across chunks.

## 12. Tips for Building With AI

- Build one step at a time and test before moving on
- Give the AI the JSON schemas from section 5 up front
- Ask it to write Zod validators alongside each prompt
- Keep prompts in one file for easy tuning

## 13. Demo Script (for your presentation)

1. Paste a chapter on an OS topic
2. Show generated topics
3. Give a deliberately weak explanation, score ~40%
4. Show missed points and the incorrect statement flagged
5. Study the flashcards
6. Re-explain, score ~75%
7. Show the progress chart rising

## 14. Report Sections to Highlight

- Feynman technique as the learning-science basis
- Chunk-and-merge pipeline for long documents
- Fixed checklist grading for consistent scores
- Score computed in code, not by the LLM
- Limitations and future work (OCR, math/code topics, spaced repetition, multi-user accounts)

## 15. Future Work

- Spaced repetition scheduling for flashcards
- OCR for scanned notes
- Slides and YouTube transcript input
- User accounts and cloud sync
- Support for math and code topics
