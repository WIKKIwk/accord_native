import { adminItemCreateCustomerSubtitle, type AdminItemCreateCustomer } from './adminItemCreateModel';
import { dartTrim } from './dartJsonString';
import type { AdminItemCreatePicker } from './adminItemCreateController';

export function adminItemCreatePickerRows(picker: AdminItemCreatePicker) {
  return picker.kind === 'customer' ? picker.controller.sortedItems.map((item, index) => ({ item, index, title: item.name, subtitle: dartTrim(adminItemCreateCustomerSubtitle(item)) })) :
    picker.controller.sortedItems.map((item, index) => ({ item, index, title: item, subtitle: '' }));
}
export type AdminItemCreatePickerRow = Readonly<{ item: string | AdminItemCreateCustomer; index: number; title: string; subtitle: string }>;
