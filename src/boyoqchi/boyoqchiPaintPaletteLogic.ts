import type { ReturnedPaintDraft } from './returnedPaintDraft';
import type { BoyoqchiPaintPaletteProps } from './boyoqchiPaintPaletteTypes';

// @v2 ReturnedPaintSheet: both native palettes share the source's groups and swatch tones.
export const boyoqchiPaintGroups = [
  { id: 'colors', title: 'Ranglar' }, { id: 'lacquers', title: 'Laklar' },
  { id: 'solvents', title: 'Erituvchilar / spirtli suyuqliklar' },
] as const;
export const boyoqchiPaintTones: Record<string, readonly [string, string]> = {
  Mix: ['#8A6A4A', '#FFFFFF'], Pantone: ['#8E6BBE', '#FFFFFF'], Oq: ['#F8F7F2', '#332C26'],
  Sariq: ['#FFD54F', '#3B2A00'], Qizil: ['#E53935', '#FFFFFF'], 'Ko‘k': ['#1E88E5', '#FFFFFF'],
  Tilla: ['#D4A72C', '#332100'], Kumush: ['#C7CDD3', '#273038'], Qora: ['#202124', '#FFFFFF'],
  Lak: ['#B7BCC2', '#273038'], Spirtlar: ['#E4B77A', '#3E2815'],
};

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
