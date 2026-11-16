import type { AdminItemDetail } from './adminItemDetailModel';
import { dartTrim } from './dartJsonString';

export type AdminItemDetailEditDraft = Readonly<{ code: string; name: string }>;
export type AdminItemDetailEditValidation = 'detail.code_required' | 'detail.name_required';
/** @v2 _AdminItemEditDialogState._save; code validation takes precedence. */
export function adminItemDetailEditDraft(code: string, name: string): AdminItemDetailEditDraft | AdminItemDetailEditValidation {
  const draft = Object.freeze({ code: dartTrim(code), name: dartTrim(name) });
  return !draft.code ? 'detail.code_required' : !draft.name ? 'detail.name_required' : draft;
}
export const adminItemDetailEditUnchanged = (draft: AdminItemDetailEditDraft, detail: AdminItemDetail): boolean => draft.code === detail.code && draft.name === detail.name;
/** @v2 _showError; rename deliberately uses the unmodified String(error) instead. */
export function adminItemDetailOperationMessage(error: unknown, fallback: string): string {
  return dartTrim(String(error).replace('Exception: ', '')) || fallback;
}
/** Source customer failure removes the first Exception prefix without trimming whitespace. */
export const adminItemDetailCustomerError = (error: unknown): string => String(error).replace('Exception: ', '');
