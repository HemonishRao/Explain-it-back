const DEFAULT_CHUNK_SIZE = 3_500;
const DEFAULT_OVERLAP = 300;

export function splitMaterialIntoChunks(text, chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_OVERLAP) {
  if (text.length <= chunkSize) return [text];
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const target = Math.min(start + chunkSize, text.length);
    let end = target;
    if (target < text.length) {
      const minBoundary = start + Math.floor(chunkSize * 0.6);
      const paragraphBoundary = text.lastIndexOf('\n\n', target);
      const sentenceBoundary = Math.max(text.lastIndexOf('. ', target), text.lastIndexOf('? ', target), text.lastIndexOf('! ', target));
      if (paragraphBoundary >= minBoundary) end = paragraphBoundary + 2;
      else if (sentenceBoundary >= minBoundary) end = sentenceBoundary + 1;
      else {
        const wordBoundary = text.lastIndexOf(' ', target);
        if (wordBoundary >= minBoundary) end = wordBoundary + 1;
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= text.length) break;

    start = Math.max(start + 1, end - overlap);
  }
  return chunks;
}
