import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import multer from 'multer';
import { materialRequestSchema, materialUploadRequestSchema } from '../schemas.js';
import { folderExists, getTopicsForMaterial, materialExists, saveMaterial } from '../db.js';
import { extractTopics } from '../services/extraction.js';
import { extractPdfText } from '../services/pdf.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (path.extname(file.originalname).toLowerCase() !== '.pdf' || file.mimetype !== 'application/pdf') {
      const error = new Error('Please choose a PDF file.');
      error.status = 415;
      callback(error);
      return;
    }
    callback(null, true);
  },
});

function handlePdfUpload(req, res, next) {
  upload.single('file')(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'PDF files must be 10 MB or smaller.' });
    return res.status(error.status || 400).json({ error: error.status ? error.message : 'Could not receive this PDF. Please try again.' });
  });
}

router.post('/', handlePdfUpload, async (req, res) => {
  try {
    let input;
    if (req.file) {
      const metadata = materialUploadRequestSchema.parse(req.body);
      let text;
      try { text = await extractPdfText(req.file.buffer); }
      catch { return res.status(400).json({ error: 'Could not read this PDF. Make sure it is a valid, text-based PDF.' }); }
      if (!text) return res.status(400).json({ error: 'This PDF has no readable text. Try a text-based PDF or paste the material.' });
      input = materialRequestSchema.parse({
        title: metadata.title,
        text,
        folderId: metadata.folderId,
        folderName: metadata.folderName,
      });
    } else {
      input = materialRequestSchema.parse(req.body);
    }
    if (input.folderId && !folderExists(input.folderId)) return res.status(404).json({ error: 'That folder no longer exists. Choose another folder.' });
    const topics = await extractTopics(input.text);
    const materialId = randomUUID();
    const folderId = saveMaterial({
      id: materialId,
      title: input.title || 'Untitled study material',
      text: input.text,
      topics,
      folderId: input.folderId,
      folderName: input.folderName || input.title || 'Untitled folder',
    });
    return res.status(201).json({ materialId, folderId, topics: getTopicsForMaterial(materialId) });
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ error: error.issues[0]?.message || 'Please check the submitted material.' });
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'Something went wrong while processing the material.' });
  }
});

router.get('/:id/topics', (req, res) => {
  try {
    if (!materialExists(req.params.id)) return res.status(404).json({ error: 'Material not found.' });
    const topics = getTopicsForMaterial(req.params.id);
    return res.json({ topics });
  } catch { return res.status(500).json({ error: 'Could not load topics right now.' }); }
});

export default router;
