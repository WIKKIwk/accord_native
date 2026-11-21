import { productionNoteText } from './productionOrderNote';

export type PreparationOutputNote = Readonly<{
  text: string;
  revision: number;
  updated_by_name: string;
  updated_at: string;
}>;

export function preparationOutputNoteFromJson(value: unknown): PreparationOutputNote | null {
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('Eslatma ma’lumoti noto‘g‘ri');
  const { text, revision, updated_by_name, updated_at } = value as Record<string, unknown>;
  if (typeof text !== 'string' || typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 1 ||
      typeof updated_by_name !== 'string' || typeof updated_at !== 'string' || !Number.isFinite(Date.parse(updated_at))) {
    throw new Error('Eslatma ma’lumoti noto‘g‘ri');
  }
  productionNoteText(text);
  return { text, revision, updated_by_name, updated_at };
}
