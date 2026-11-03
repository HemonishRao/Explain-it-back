import { Router } from 'express';
import { attemptRequestSchema } from '../schemas.js';
import { gradeExplanation } from '../services/grading.js';
import { getAttemptDetails, getTopicAttemptHistory } from '../db.js';
import { generateStudyItems } from '../services/remediation.js';

export const topicAttemptsRouter = Router({ mergeParams: true });

topicAttemptsRouter.post('/', async (req, res) => {
  try {
    const { answerText } = attemptRequestSchema.parse(req.body);
    const attempt = await gradeExplanation(req.params.topicId, answerText);
    return res.status(201).json(attempt);
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ error: error.issues[0]?.message || 'Please check your explanation.' });
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'Something went wrong while grading this explanation.' });
  }
});

topicAttemptsRouter.get('/', (req, res) => {
  try {
    const history = getTopicAttemptHistory(req.params.topicId);
    if (!history) return res.status(404).json({ error: 'Topic not found.' });
    return res.json(history);
  } catch {
    return res.status(500).json({ error: 'Could not load this topic’s progress right now.' });
  }
});

const router = Router();

router.post('/:id/study', async (req, res) => {
  try {
    return res.json(await generateStudyItems(req.params.id));
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'Could not create study aids right now.' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const details = getAttemptDetails(req.params.id);
    if (!details) return res.status(404).json({ error: 'Attempt not found.' });
    return res.json(details);
  } catch {
    return res.status(500).json({ error: 'Could not load these results right now.' });
  }
});

export default router;
