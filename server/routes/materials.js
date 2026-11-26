import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import multer from 'multer';
import { materialRequestSchema, materialUploadRequestSchema } from '../schemas.js';
import { deleteMaterial, folderExists, getTopicsForMaterial, materialExists, saveMaterial } from '../db.js';
import { extractTopics } from '../services/extraction.js';
import { extractPdfText } from '../services/pdf.js';

const router = Router();
const ALLOWED_PDF_MIME_TYPES = new Set(['application/pdf', 'application/x-pdf', 'application/octet-stream']);
const ALLOWED_TXT_MIME_TYPES = new Set(['text/plain', 'application/octet-stream']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const validPdf = ext === '.pdf' && ALLOWED_PDF_MIME_TYPES.has(file.mimetype);
    const validTxt = ext === '.txt' && ALLOWED_TXT_MIME_TYPES.has(file.mimetype);
    if (!validPdf && !validTxt) {
      const error = new Error('Please choose a PDF or .txt file.');
      error.status = 415;
      callback(error);
      return;
    }
    callback(null, true);
  },
});

function handleMaterialUpload(req, res, next) {
  upload.single('file')(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Uploaded files must be 10 MB or smaller.' });
    return res.status(error.status || 400).json({ error: error.status ? error.message : 'Could not receive this file. Please try again.' });
  });
}

router.post('/', handleMaterialUpload, async (req, res) => {
  try {
    let input;
    if (req.file) {
      const metadata = materialUploadRequestSchema.parse(req.body);
      const ext = path.extname(req.file.originalname).toLowerCase();
      let text;
      if (ext === '.txt') {
        text = req.file.buffer.toString('utf8').trim();
        if (!text) return res.status(400).json({ error: 'This text file is empty. Add study notes or paste the material.' });
      } else {
        if (req.file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
          return res.status(415).json({ error: 'This file does not look like a valid PDF.' });
        }
        try { text = await extractPdfText(req.file.buffer); }
        catch { return res.status(400).json({ error: 'Could not read this PDF. Make sure it is a valid, text-based PDF.' }); }
        if (!text) return res.status(400).json({ error: 'This PDF has no readable text. Try a text-based PDF or paste the material.' });
      }
      if (text.length > 50_000) {
        return res.status(400).json({ error: `This file has ${text.length.toLocaleString()} characters, which exceeds the 50,000-character limit. Upload a shorter excerpt or fewer pages.` });
      }
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

router.delete('/:id', (req, res) => {
  try {
    if (!deleteMaterial(req.params.id)) return res.status(404).json({ error: 'Material not found.' });
    return res.json({ deleted: true });
  } catch {
    return res.status(500).json({ error: 'Could not delete this material right now.' });
  }
});

export default router;
