import type { ReturnedPaintDraft } from './returnedPaintDraft';
import type { BoyoqchiPaintPaletteProps } from './boyoqchiPaintPaletteTypes';

type Option = { name: string; fields: readonly string[] };
/** @v2 _completionIndicator: non-empty fields, not numeric validity, decide the glyph. */
export function boyoqchiPaintCompletion(draft: ReturnedPaintDraft, usage: BoyoqchiPaintPaletteProps['usage'], option: Option): 'partial' | 'complete' | null {
  const valuesFor = (name: string, base: readonly string[]) => {
    const key = `${usage}:${name}`, fields = draft.fieldLabelsFor(key, base);
    return draft.valuesFor(key, fields.length);
  };
  const values = option.name === 'Pantone'
    ? [...valuesFor('Pantone', []), ...valuesFor('Pantone Mix', [])]
    : valuesFor(option.name, option.fields);
  const filled = values.map(value => value.trim().length > 0);
  if (filled.every(value => !value)) return null;
  return filled.every(Boolean) ? 'complete' : 'partial';
}
