import type { SavedAccount } from '../savedAccountStore';

const roles: Record<string, string> = {
  tayyorlov_masteri: 'Tayyorlov masteri', homashyo_rezkachi: 'Homashyo rezkachisi', rezka_master: 'Rezka master',
  brigader: 'Brigader', sales_manager: 'Sotuv manageri', werka: 'Werka', customer: 'Haridor', aparatchi: 'Aparatchi',
  qolipchi: 'Qolipchi', boyoqchi: 'Bo‘yoqchi', material_taminotchi: 'Material ta\'minotchisi', admin: 'Admin',
};
const trimmed = (value: unknown) => typeof value === 'string' ? value.trim() : '';

/** @v2 _displayName */
export function savedAccountDisplayName(account: SavedAccount): string {
  return trimmed(account.profile.display_name) || trimmed(account.profile.legal_name) || trimmed(account.profile.ref);
}

/** @v2 _accountSubtitle */
export function savedAccountSubtitle(account: SavedAccount): string {
  const profile = account.profile, role = trimmed(profile.role);
  const fallback = roles[role] ?? 'Ta\'minotchi';
  if (role !== 'aparatchi') return fallback;
  const labels = Array.isArray(profile.assigned_apparatus_labels) ? profile.assigned_apparatus_labels
    .map(trimmed).map(label => label.replace(/\s+apparat(?:i)?$/i, '').replace(/\s+aparat(?:i)?$/i, '')).filter(Boolean) : [];
  if (!labels.length) return fallback;
  const assigned = Array.isArray(profile.assigned_apparatus) ? profile.assigned_apparatus.length : 0;
  const remaining = Math.max(0, (assigned || labels.length) - 1);
  return remaining ? `${labels[0]} +${remaining}` : labels[0];
}
