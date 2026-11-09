import { trimDart } from './qolipApiCommon';
import type { QolipLocationEntry } from './qolipLocationsApi';

/** Row text from _QolipBlockGrid._pickQolipLocation at f119, without sorting or normalizing visible values. */
export function qolipLocationChoiceLabel(item: QolipLocationEntry, quantityText: string): { title: string; subtitle: string } {
  return {
    title: trimDart(item.item_name) ? item.item_name : item.qolip_code,
    subtitle: [item.qolip_code, String(item.size), quantityText, ...(trimDart(item.location_label) ? [item.location_label] : [])]
      .filter(value => !!trimDart(value)).join(' • '),
  };
}
