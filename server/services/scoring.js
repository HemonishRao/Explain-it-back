const statusValues = { covered: 1, partial: 0.5, missed: 0 };

export function calculateScore(results, keyPoints) {
  const importanceById = new Map(keyPoints.map((point) => [point.id, point.importance]));
  const totalImportance = keyPoints.reduce((sum, point) => sum + point.importance, 0);
  if (!totalImportance) return 0;
  const weightedPoints = results.reduce((sum, result) => sum + statusValues[result.status] * importanceById.get(result.keyPointId), 0);
  return Math.round((weightedPoints / totalImportance) * 1000) / 10;
}
