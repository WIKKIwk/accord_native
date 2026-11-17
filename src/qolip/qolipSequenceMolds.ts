import type { qolipProductFromJson } from '../qolipCatalogApi';
export type QolipSequenceMold = ReturnType<typeof qolipProductFromJson>;
/** V2 _SequenceQolipSheet._load / _loadAttachedQolips retain first code spelling before sorting. */
export function qolipSequenceMolds(products: readonly QolipSequenceMold[]): QolipSequenceMold[] {
  const seen = new Set<string>();
  return products.filter(product => {
    const code = product.qolip_code.trim().toLowerCase(); if (!code || seen.has(code)) return false; seen.add(code); return true;
  }).sort((a, b) => a.qolip_code.toLowerCase() < b.qolip_code.toLowerCase() ? -1 : a.qolip_code.toLowerCase() > b.qolip_code.toLowerCase() ? 1 : 0);
}
