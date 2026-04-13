/**
 * Splits raw text into overlapping chunks for embedding.
 * Tries to break on sentence/paragraph boundaries for cleaner chunks.
 *
 * @param text     Full raw text of a material
 * @param size     Target characters per chunk (default 500)
 * @param overlap  Overlap between consecutive chunks (default 100)
 * @returns        Array of chunk strings, no empty strings
 */
export function chunkText(
  text: string,
  size = 500,
  overlap = 100
): string[] {
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (cleaned.length === 0) return [];
  if (cleaned.length <= size) return [cleaned];

  const chunks: string[] = [];
  let start = 0;

  while (start < cleaned.length) {
    const end = Math.min(start + size, cleaned.length);
    let slice = cleaned.slice(start, end);

    // If we're not at the end, try to snap the boundary to a sentence or newline
    if (end < cleaned.length) {
      const lastNewline = slice.lastIndexOf("\n");
      const lastPeriod = slice.lastIndexOf(". ");
      const snap = Math.max(lastNewline, lastPeriod);
      if (snap > size * 0.5) {
        // Only snap if the boundary is in the latter half of the chunk
        slice = cleaned.slice(start, start + snap + 1);
      }
    }

    const trimmed = slice.trim();
    if (trimmed.length > 0) {
      chunks.push(trimmed);
    }

    // Advance by (slice.length - overlap), minimum 1 to avoid infinite loop
    const advance = Math.max(slice.length - overlap, 1);
    start += advance;
  }

  return chunks;
}
