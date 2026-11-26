import { Router } from 'express';
import { getTopicForExplain } from '../db.js';
import { hintRequestSchema } from '../schemas.js';
import { generateTopicHint } from '../services/hint.js';

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

async function handleHint(req, res) {
  try {
    const { explanationSoFar } = hintRequestSchema.parse(req.body || {});
    return res.json(await generateTopicHint(req.params.id, explanationSoFar));
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ error: error.issues[0]?.message || 'Invalid hint request.' });
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'Could not generate a hint right now.' });
  }
}

router.get('/:id/hint', handleHint);
router.post('/:id/hint', handleHint);

export default router;
