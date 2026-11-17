export const MAX_PRODUCTION_NOTE_CHARS = 2000;

export type ProductionOrderNote = Readonly<{
  order_id: string; text: string; revision: number;
  updated_by_ref: string; updated_by_name: string; updated_at: string | null;
}>;

export function productionNoteText(value: string): string {
  const text = value.trim();
  if (text.includes('\0') || Array.from(text).length > MAX_PRODUCTION_NOTE_CHARS) {
    throw new Error('Eslatma 2000 belgidan oshmasligi kerak');
  }
  return text;
}

export function emptyProductionOrderNote(orderId: string): ProductionOrderNote {
  return Object.freeze({ order_id: orderId, text: '', revision: 0, updated_by_ref: '', updated_by_name: '', updated_at: null });
}

export function productionOrderNoteFromJson(value: unknown, expectedOrderId?: string): ProductionOrderNote {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Eslatma ma’lumoti noto‘g‘ri');
  const row = value as Record<string, unknown>;
  if (typeof row.order_id !== 'string' || !row.order_id.trim() || row.order_id !== row.order_id.trim() ||
      (expectedOrderId !== undefined && row.order_id !== expectedOrderId) || typeof row.text !== 'string' ||
      typeof row.revision !== 'number' || !Number.isSafeInteger(row.revision) || row.revision < 0 ||
      typeof row.updated_by_ref !== 'string' || typeof row.updated_by_name !== 'string' ||
      (row.updated_at !== null && typeof row.updated_at !== 'string') ||
      (row.revision === 0 && row.text !== '') ||
      (row.revision > 0 && (!row.updated_by_ref.trim() || !row.updated_at || !Number.isFinite(Date.parse(row.updated_at))))) {
    throw new Error('Eslatma ma’lumoti noto‘g‘ri');
  }
  productionNoteText(row.text);
  return Object.freeze({ order_id: row.order_id, text: row.text, revision: row.revision,
    updated_by_ref: row.updated_by_ref, updated_by_name: row.updated_by_name, updated_at: row.updated_at });
}

/** A polling response that began before a save must not restore the old text. */
export function latestProductionOrderNote(incoming: ProductionOrderNote, confirmed: ProductionOrderNote | null): ProductionOrderNote {
  return confirmed?.order_id === incoming.order_id && confirmed.revision > incoming.revision ? confirmed : incoming;
}
