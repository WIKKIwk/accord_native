import { dartTrim } from './dartJsonString';

/** @v2 _werkaInitials */
export function adminWerkaInitials(name: string): string {
  const parts = dartTrim(name).split(/\s+/u).filter(part => dartTrim(part));
  if (!parts.length) return 'O';
  const first = (value: string) => {
    const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
    return (segmenter ? [...segmenter.segment(value)][0]?.segment : [...value][0])?.toUpperCase() ?? '';
  };
  return parts.length === 1 ? first(parts[0]) : `${first(parts[0])}${first(parts.at(-1)!)}`;
}
