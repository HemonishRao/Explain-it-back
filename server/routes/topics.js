import { Router } from 'express';
import { getTopicForExplain } from '../db.js';

const router = Router();

router.get('/:id', (req, res) => {
  try {
    const topic = getTopicForExplain(req.params.id);
    if (!topic) return res.status(404).json({ error: 'Topic not found.' });
    return res.json({ topic });
  } catch {
    return res.status(500).json({ error: 'Could not load this topic right now.' });
  }
});

export default router;
