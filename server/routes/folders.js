import { Router } from 'express';
import { deleteFolder, getFoldersWithTopics } from '../db.js';

const router = Router();

router.get('/', (_req, res) => {
  try {
    return res.json({ folders: getFoldersWithTopics() });
  } catch {
    return res.status(500).json({ error: 'Could not load folders right now.' });
  }
});

router.delete('/:id', (req, res) => {
  try {
    if (!deleteFolder(req.params.id)) return res.status(404).json({ error: 'Folder not found.' });
    return res.json({ deleted: true });
  } catch {
    return res.status(500).json({ error: 'Could not delete this folder right now.' });
  }
});

export default router;
