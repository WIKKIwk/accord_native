import { graphemeSegments } from 'unicode-segmenter/grapheme';

/** Flutter characters-1.4.1 and this pinned segmenter both use Unicode 16 extended grapheme clusters. */
export function qolipLimitGraphemes(value: string, limit: number): string {
  if (limit <= 0) return '';
  let count = 0;
  for (const { index } of graphemeSegments(value)) {
    if (count++ === limit) return value.slice(0, index);
  }
  return value;
}
