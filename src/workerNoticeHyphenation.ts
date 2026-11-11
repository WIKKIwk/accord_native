// Uzbek vowel-boundary/digraph rules adapted from UzSyllable (MIT),
// UlugbekSalaev/UzSyllable@7d874c708be555c1df3d2cdbc15251a1710ef56a.
// Copyright (c) 2018 The Python Packaging Authority.
// License: docs/third-party/UzSyllable-LICENSE.txt.

export const SOFT_HYPHEN = '\u00ad';
const apostrophes = new Set(["'", '‘', '’', 'ʻ', 'ʼ', '`', '＇']);
const vowels = new Set(['a', 'e', 'i', 'o', 'u']);
type Letter = { start: number; end: number; vowel: boolean };

/** Candidate line-break positions, never permanent hyphens in the stored text. */
function breakPositions(word: string): number[] {
  if (word.length < 4 || (word.match(/[A-Z]/g)?.length ?? 0) > 1) return [];
  const lower = word.toLowerCase(), letters: Letter[] = [];
  for (let i = 0; i < lower.length;) {
    const start = i, character = lower[i];
    if (!/[a-z]/.test(character)) return []; // Unhandled tutuq/foreign spelling stays intact.
    i++;
    if ((character === 'o' || character === 'g') && apostrophes.has(lower[i])) i++;
    else if (['sh', 'ch', 'ng'].includes(lower.slice(start, start + 2))) i++;
    letters.push({ start, end: i, vowel: vowels.has(character) });
  }
  const nuclei = letters.flatMap((letter, index) => letter.vowel ? [index] : []), positions: number[] = [];
  for (let i = 1; i < nuclei.length; i++) {
    const vowel = nuclei[i], preceding = nuclei[i - 1];
    const boundary = letters[vowel === preceding + 1 ? vowel : vowel - 1].start;
    // A single-letter syllable cannot be left alone at either end of a line.
    const left = letters.filter(letter => letter.end <= boundary).length;
    const right = letters.length - left;
    if (left >= 2 && right >= 2) positions.push(boundary);
  }
  return positions;
}

/** Display-only Latin Uzbek hyphenation; quoted names, codes and other locales stay untouched. */
export function hyphenateWorkerNotice(message: string, locale: string): string {
  if (locale.toLowerCase().split(/[-_]/)[0] !== 'uz' || message.includes(SOFT_HYPHEN)) return message;
  const protectedRanges = [...message.matchAll(/https?:\/\/\S+|www\.\S+|[^\s@]+@[^\s@]+|“[^”]*”|«[^»]*»|"[^"]*"/g)]
    .map(match => ({ start: match.index!, end: match.index! + match[0].length }));
  return message.replace(/[A-Za-z][A-Za-z'‘’ʻʼ`＇]*/g, (word: string, offset: number) => {
    if (protectedRanges.some(range => offset >= range.start && offset < range.end)) return word;
    const before = message[offset - 1] ?? '', after = message[offset + word.length] ?? '';
    if (/[\p{L}\p{N}_:/@-]/u.test(before + after)) return word;
    const positions = new Set(breakPositions(word));
    return [...word].map((character, index) => `${positions.has(index) ? SOFT_HYPHEN : ''}${character}`).join('');
  });
}
