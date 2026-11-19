import './config.js';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import materialsRouter from './routes/materials.js';
import foldersRouter from './routes/folders.js';
import topicsRouter from './routes/topics.js';
import attemptsRouter, { topicAttemptsRouter } from './routes/attempts.js';

const app = express();
const port = Number(process.env.PORT) || 5000;
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const allowedOrigins = new Set(
  (process.env.CORS_ORIGIN || '').split(',').map((origin) => origin.trim()).filter(Boolean),
);

app.use(express.json({ limit: '250kb' }));
app.use('/api', (req, res, next) => {
  const origin = req.get('Origin');
  if (!origin || !allowedOrigins.has(origin)) {
    if (req.method === 'OPTIONS' && origin && allowedOrigins.size) {
      return res.status(403).json({ error: 'This frontend origin is not allowed.' });
    }
    return next();
  }

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.sendStatus(204);
  }
  return next();
});

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/materials', materialsRouter);
app.use('/api/folders', foldersRouter);
app.use('/api/topics', topicsRouter);
app.use('/api/topics/:topicId/attempts', topicAttemptsRouter);
app.use('/api/attempts', attemptsRouter);
app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
app.use(express.static(path.join(projectRoot, 'dist')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  return res.sendFile(path.join(projectRoot, 'dist', 'index.html'), (error) => {
    if (error) next();
  });
});
app.use((error, _req, res, _next) => {
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large. Check the material and explanation limits.' });
  return res.status(400).json({ error: 'Invalid request.' });
});
app.listen(port, () => console.log(`Explain It Back API listening on port ${port}`));
