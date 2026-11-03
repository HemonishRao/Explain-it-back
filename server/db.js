import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const databasePath = process.env.DATABASE_PATH || path.join(directory, 'explain-it-back.sqlite');
const db = new Database(databasePath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS folders (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS materials (id TEXT PRIMARY KEY, folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE, title TEXT NOT NULL, raw_text TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS topics (id TEXT PRIMARY KEY, material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE, title TEXT NOT NULL, summary TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS key_points (id TEXT PRIMARY KEY, topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE, text TEXT NOT NULL, importance INTEGER NOT NULL CHECK (importance BETWEEN 1 AND 3));
  CREATE TABLE IF NOT EXISTS attempts (id TEXT PRIMARY KEY, topic_id TEXT NOT NULL REFERENCES topics(id), answer_text TEXT NOT NULL, score REAL NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS attempt_results (id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE, key_point_id TEXT NOT NULL REFERENCES key_points(id), status TEXT NOT NULL CHECK (status IN ('covered', 'partial', 'missed')), evidence TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS incorrect_statements (id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE, user_said TEXT NOT NULL, correction TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS study_items (id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE, key_point_id TEXT NOT NULL REFERENCES key_points(id), keywords_json TEXT NOT NULL, flashcards_json TEXT NOT NULL, UNIQUE(attempt_id, key_point_id));
`);

const materialColumns = db.prepare('PRAGMA table_info(materials)').all().map((column) => column.name);
if (!materialColumns.includes('folder_id')) {
  db.exec('ALTER TABLE materials ADD COLUMN folder_id TEXT REFERENCES folders(id) ON DELETE CASCADE');
}
const existingMaterials = db.prepare('SELECT id, title FROM materials WHERE folder_id IS NULL').all();
if (existingMaterials.length) {
  db.transaction(() => {
    const insertFolder = db.prepare('INSERT INTO folders (id, name) VALUES (?, ?)');
    const assignFolder = db.prepare('UPDATE materials SET folder_id = ? WHERE id = ?');
    for (const material of existingMaterials) {
      const folderId = randomUUID();
      insertFolder.run(folderId, material.title || 'Untitled folder');
      assignFolder.run(folderId, material.id);
    }
  })();
}

export function saveMaterial({ id, title, text, topics, folderId, folderName }) {
  return db.transaction(() => {
    const destinationFolderId = folderId || randomUUID();
    if (!folderId) {
      db.prepare('INSERT INTO folders (id, name) VALUES (?, ?)').run(destinationFolderId, folderName?.trim() || title || 'Untitled folder');
    }
    db.prepare('INSERT INTO materials (id, folder_id, title, raw_text) VALUES (?, ?, ?, ?)').run(id, destinationFolderId, title, text);
    const insertTopic = db.prepare('INSERT INTO topics (id, material_id, title, summary) VALUES (?, ?, ?, ?)');
    const insertPoint = db.prepare('INSERT INTO key_points (id, topic_id, text, importance) VALUES (?, ?, ?, ?)');
    for (const topic of topics) {
      insertTopic.run(topic.id, id, topic.title, topic.summary);
      for (const point of topic.keyPoints) insertPoint.run(point.id, topic.id, point.text, point.importance);
    }
    return destinationFolderId;
  })();
}

export function folderExists(folderId) {
  return Boolean(db.prepare('SELECT 1 FROM folders WHERE id = ?').get(folderId));
}

export function getFoldersWithTopics() {
  const rows = db.prepare(`
    SELECT folders.id AS folderId, folders.name AS folderName, folders.created_at AS folderCreatedAt,
      materials.id AS materialId, materials.title AS materialTitle, materials.created_at AS materialCreatedAt,
      topics.id AS topicId, topics.title AS topicTitle, topics.summary AS topicSummary
    FROM folders
    LEFT JOIN materials ON materials.folder_id = folders.id
    LEFT JOIN topics ON topics.material_id = materials.id
    ORDER BY folders.created_at DESC, folders.rowid DESC, materials.rowid, topics.rowid
  `).all();
  const folders = new Map();
  for (const row of rows) {
    if (!folders.has(row.folderId)) {
      folders.set(row.folderId, {
        id: row.folderId,
        name: row.folderName,
        createdAt: row.folderCreatedAt,
        materials: [],
        materialCount: 0,
        topicCount: 0,
      });
    }
    const folder = folders.get(row.folderId);
    if (!row.materialId) continue;
    let material = folder.materials.at(-1);
    if (!material || material.id !== row.materialId) {
      material = { id: row.materialId, title: row.materialTitle, createdAt: row.materialCreatedAt, topics: [] };
      folder.materials.push(material);
      folder.materialCount += 1;
    }
    if (row.topicId) {
      material.topics.push({ id: row.topicId, title: row.topicTitle, summary: row.topicSummary });
      folder.topicCount += 1;
    }
  }
  return [...folders.values()];
}

export function deleteFolder(folderId) {
  return db.transaction(() => {
    if (!folderExists(folderId)) return false;
    db.prepare(`
      DELETE FROM attempts
      WHERE topic_id IN (
        SELECT topics.id FROM topics
        JOIN materials ON materials.id = topics.material_id
        WHERE materials.folder_id = ?
      )
    `).run(folderId);
    db.prepare('DELETE FROM materials WHERE folder_id = ?').run(folderId);
    db.prepare('DELETE FROM folders WHERE id = ?').run(folderId);
    return true;
  })();
}

export function getTopicsForMaterial(materialId) {
  return db.prepare('SELECT id, title, summary FROM topics WHERE material_id = ? ORDER BY rowid').all(materialId);
}

export function materialExists(materialId) {
  return Boolean(db.prepare('SELECT 1 FROM materials WHERE id = ?').get(materialId));
}

export function getTopicForExplain(topicId) {
  return db.prepare('SELECT id, title, summary FROM topics WHERE id = ?').get(topicId);
}

export function getTopicKeyPoints(topicId) {
  return db.prepare('SELECT id, text, importance FROM key_points WHERE topic_id = ? ORDER BY rowid').all(topicId);
}

export function getTopicAttemptHistory(topicId) {
  const topic = db.prepare('SELECT id, title, summary FROM topics WHERE id = ?').get(topicId);
  if (!topic) return null;
  const attempts = db.prepare(`
    SELECT id, score, created_at AS createdAt
    FROM attempts WHERE topic_id = ? ORDER BY created_at, rowid
  `).all(topicId);
  return { topic, attempts };
}

export function saveAttempt({ id, topicId, answerText, score, results, incorrectStatements }) {
  db.transaction(() => {
    db.prepare('INSERT INTO attempts (id, topic_id, answer_text, score) VALUES (?, ?, ?, ?)').run(id, topicId, answerText, score);
    const insertResult = db.prepare('INSERT INTO attempt_results (id, attempt_id, key_point_id, status, evidence) VALUES (?, ?, ?, ?, ?)');
    for (const result of results) insertResult.run(result.id, id, result.keyPointId, result.status, result.evidence);
    const insertIncorrect = db.prepare('INSERT INTO incorrect_statements (id, attempt_id, user_said, correction) VALUES (?, ?, ?, ?)');
    for (const statement of incorrectStatements) insertIncorrect.run(statement.id, id, statement.userSaid, statement.correction);
  })();
}

export function getAttemptDetails(attemptId) {
  const attempt = db.prepare(`
    SELECT attempts.id, attempts.topic_id AS topicId, attempts.score, attempts.created_at AS createdAt, topics.title AS topicTitle
    FROM attempts JOIN topics ON topics.id = attempts.topic_id
    WHERE attempts.id = ?
  `).get(attemptId);
  if (!attempt) return null;

  const results = db.prepare(`
    SELECT attempt_results.key_point_id AS keyPointId, key_points.text, key_points.importance, attempt_results.status, attempt_results.evidence
    FROM attempt_results JOIN key_points ON key_points.id = attempt_results.key_point_id
    WHERE attempt_results.attempt_id = ?
    ORDER BY attempt_results.rowid
  `).all(attemptId);
  const incorrectStatements = db.prepare(`
    SELECT user_said AS userSaid, correction
    FROM incorrect_statements WHERE attempt_id = ? ORDER BY rowid
  `).all(attemptId);
  return { attempt, results, incorrectStatements };
}

export function getWeakPointsForAttempt(attemptId) {
  return db.prepare(`
    SELECT attempt_results.key_point_id AS id, key_points.text, attempt_results.status
    FROM attempt_results JOIN key_points ON key_points.id = attempt_results.key_point_id
    WHERE attempt_results.attempt_id = ? AND attempt_results.status IN ('missed', 'partial')
    ORDER BY attempt_results.rowid
  `).all(attemptId);
}

export function getStudyItems(attemptId) {
  return db.prepare(`
    SELECT study_items.key_point_id AS keyPointId, key_points.text AS keyPointText,
      study_items.keywords_json AS keywordsJson, study_items.flashcards_json AS flashcardsJson
    FROM study_items JOIN key_points ON key_points.id = study_items.key_point_id
    WHERE study_items.attempt_id = ? ORDER BY study_items.rowid
  `).all(attemptId).map((item) => ({
    keyPointId: item.keyPointId,
    keyPointText: item.keyPointText,
    keywords: JSON.parse(item.keywordsJson),
    flashcards: JSON.parse(item.flashcardsJson),
  }));
}

export function saveStudyItems(attemptId, items) {
  const insert = db.prepare(`
    INSERT INTO study_items (id, attempt_id, key_point_id, keywords_json, flashcards_json)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(attempt_id, key_point_id) DO NOTHING
  `);
  db.transaction(() => {
    for (const item of items) insert.run(item.id, attemptId, item.keyPointId, JSON.stringify(item.keywords), JSON.stringify(item.flashcards));
  })();
}
