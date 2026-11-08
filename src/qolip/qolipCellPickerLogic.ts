import { trimDart } from './qolipApiCommon';
import { qolipGridLetters, qolipGridRowCount } from './qolipGridLogic';

/** @v2 normalizeQolipCellLabel */
export function normalizeQolipCellLabel(raw: string): string | null {
  const letters = raw.replace(/[^A-Za-z]/g, ''), digits = raw.replace(/[^0-9]/g, '');
  if (!letters || !digits) return null;
  const significant = digits.replace(/^0+/, '') || '0';
  if (significant.length > String(qolipGridRowCount).length) return null;
  const column = Number(significant);
  return column >= 1 && column <= qolipGridRowCount ? `${letters[0].toUpperCase()}${column}` : null;
}

/** @v2 allQolipCellLabels */
export function allQolipCellLabels(): string[] {
  return qolipGridLetters.flatMap(letter => Array.from({ length: qolipGridRowCount }, (_, index) => `${letter}${index + 1}`));
}

/** @v2 searchQolipCellLabels */
export function searchQolipCellLabels(query: string): string[] {
  const trimmed = trimDart(query);
  if (!trimmed) return [];
  const normalized = normalizeQolipCellLabel(trimmed), lower = trimmed.toLowerCase();
  const matches = allQolipCellLabels().filter(label => label === normalized || label.toLowerCase().includes(lower));
  if (normalized !== null) {
    const index = matches.indexOf(normalized);
    if (index >= 0) { matches.splice(index, 1); matches.unshift(normalized); }
  }
  return matches;
}
