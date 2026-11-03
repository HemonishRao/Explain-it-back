import { z } from 'zod';

export const materialTitleSchema = z.string().trim().max(120).optional();
export const folderSelectionSchema = z.object({
  folderId: z.string().min(1).optional(),
  folderName: z.string().trim().min(1, 'Enter a name for the new folder.').max(120, 'Folder names must be 120 characters or fewer.').optional(),
}).refine(({ folderId, folderName }) => !(folderId && folderName), {
  message: 'Choose an existing folder or enter a new folder name, not both.',
});

export const materialRequestSchema = z.object({
  title: materialTitleSchema,
  text: z.string().trim().min(1, 'Paste some study material first.').max(50_000, 'Material must be 50,000 characters or fewer.'),
  folderId: folderSelectionSchema.shape.folderId,
  folderName: folderSelectionSchema.shape.folderName,
}).refine(({ folderId, folderName }) => !(folderId && folderName), {
  message: 'Choose an existing folder or enter a new folder name, not both.',
});

export const materialUploadRequestSchema = z.object({
  title: materialTitleSchema,
  folderId: folderSelectionSchema.shape.folderId,
  folderName: folderSelectionSchema.shape.folderName,
}).refine(({ folderId, folderName }) => !(folderId && folderName), {
  message: 'Choose an existing folder or enter a new folder name, not both.',
});

export const topicExtractionSchema = z.object({
  topics: z.array(z.object({
    id: z.string().min(1), title: z.string().min(1), summary: z.string().min(1),
    keyPoints: z.array(z.object({ id: z.string().min(1), text: z.string().min(1), importance: z.number().int().min(1).max(3) })).min(1),
  })),
});

export const attemptRequestSchema = z.object({
  answerText: z.string().max(5_000, 'Explanation must be 5,000 characters or fewer.'),
});

export const gradingResponseSchema = z.object({
  results: z.array(z.object({
    keyPointId: z.string().min(1),
    status: z.enum(['covered', 'partial', 'missed']),
    evidence: z.string(),
  }).strict()),
  incorrectStatements: z.array(z.object({
    userSaid: z.string().min(1),
    correction: z.string().min(1),
  }).strict()).max(5),
}).strict();

export const remediationResponseSchema = z.object({
  items: z.array(z.object({
    keyPointId: z.string().min(1),
    keywords: z.array(z.string().min(1)).min(3).max(5),
    flashcards: z.array(z.object({ front: z.string().min(1), back: z.string().min(1) }).strict()).min(2).max(3),
  }).strict()),
}).strict();
