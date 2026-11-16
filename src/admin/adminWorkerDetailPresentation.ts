import { adminText } from '../shared/localization';
import { adminUserRoleLabel, type AdminUserListEntry } from './adminUsersModel';
import { adminWerkaInitials } from './adminWerkaPresentation';
import type { AdminWorkerDetailState } from './adminWorkerDetailController';
import type { AdminWorkerDetailEditorDialog } from './adminWorkerDetailEditorController';
import type { AdminWorkerDetail } from './adminWorkerDetailModel';
import { dartTrim } from './dartJsonString';

/** @v2 _workerInitials */
export const adminWorkerDetailInitials = (name: string): string => dartTrim(name) ? adminWerkaInitials(name) : 'I';
/** Source loading/error profile remains a real interactive fallback rather than hiding the whole card. */
export function adminWorkerDetailDisplay(state: AdminWorkerDetailState, entry: AdminUserListEntry, locale: string): AdminWorkerDetail {
  return state.detail ?? Object.freeze({ id: dartTrim(entry.id), name: entry.name, phone: state.loading ? adminText('detail.loading', locale) : entry.phone,
    avatar_url: '', level: adminUserRoleLabel(entry), code: state.loading ? adminText('detail.loading', locale) : '', code_locked: false, code_retry_after_sec: state.retryAfterSec });
}
export function adminWorkerDetailDialogText(dialog: AdminWorkerDetailEditorDialog, locale: string) {
  if (dialog.kind === 'warehouse') return { title: adminText('warehouse.unassign_title', locale),
    message: adminText('warehouse.unassign_message', locale, { warehouse: dialog.warehouse, name: dialog.name }),
    cancel: adminText('action.no', locale), confirm: adminText('action.yes', locale) };
  return { title: 'Biriktirishni olib tashlash', message: `${dialog.material.material_name} — ${dialog.name} endi bu homashyoli buyurtmalarni ko‘rmaydi.`,
    cancel: 'Yo‘q', confirm: 'Ha' };
}
