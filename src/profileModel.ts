import type { Session } from './auth';

export type ProfileSnapshot = {
  profile: Record<string, unknown>;
  apparatusLabels: string[];
};

const roleLabels: Record<string, string> = {
  admin: 'Administrator',
  aparatchi: 'Aparatchi',
  boyoqchi: 'Bo‘yoqchi',
  brigader: 'Brigader',
  customer: 'Mijoz',
  homashyo_rezkachi: 'Xomashyo kesuvchi',
  material_taminotchi: 'Material ta’minotchisi',
  qolipchi: 'Qolipchi',
  sales_manager: 'Sotuv menejeri',
  supplier: 'Yetkazib beruvchi',
  tayyorlov_masteri: 'Tayyorlov masteri',
  werka: 'Omborchi',
  omborchi: 'Omborchi',
};

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function profileRoleLabel(role: string): string {
  return roleLabels[text(role).toLowerCase()] ?? 'Foydalanuvchi';
}

function labels(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

/** @v2 ProfileScreen._normalizeWerkaLabel */
function normalizeWerkaLabel(value: unknown, role: string): string {
  const name = text(value);
  return role === 'werka' && name.toLowerCase() === 'werka' ? 'Wmanager' : name;
}

export function initialProfileSnapshot(session: Session): ProfileSnapshot {
  return { profile: session.profile, apparatusLabels: labels(session.assigned_apparatus_labels) };
}

/** Ignore a response that doesn't belong to the session which requested it. */
export function profileSnapshotFromResponse(session: Session, value: unknown): ProfileSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const profile = value as Record<string, unknown>;
  const ref = text(profile.ref);
  const role = text(profile.role);
  if (!ref || !role || ref !== text(session.profile.ref) || role !== text(session.profile.role)) return null;
  return {
    profile,
    apparatusLabels: Array.isArray(profile.assigned_apparatus_labels)
      ? labels(profile.assigned_apparatus_labels)
      : labels(session.assigned_apparatus_labels),
  };
}

export function profileDisplay(snapshot: ProfileSnapshot) {
  const profile = snapshot.profile;
  const role = text(profile.role).toLowerCase();
  const name = normalizeWerkaLabel(profile.display_name, role) || normalizeWerkaLabel(profile.legal_name, role) || 'Foydalanuvchi';
  const legalName = normalizeWerkaLabel(profile.legal_name, role);
  return {
    name,
    role: profileRoleLabel(role),
    phone: text(profile.phone),
    legalName: legalName && legalName !== name ? legalName : '',
    apparatusLabels: snapshot.apparatusLabels,
  };
}

/** @v2 ProfileAvatarCache.refreshFromUrl */
export function profileAvatarSource(session: Session, profile: Record<string, unknown>) {
  const rawAvatar = text(profile.avatar_url);
  if (!rawAvatar) return null;
  try {
    const uri = new URL(rawAvatar);
    if (uri.protocol !== 'https:' && uri.protocol !== 'http:') return null;
    let hash = 2166136261;
    for (let index = 0; index < rawAvatar.length; index++) hash = Math.imul(hash ^ rawAvatar.charCodeAt(index), 16777619);
    return {
      uri: rawAvatar,
      cacheKey: JSON.stringify(['profile-avatar', session.imageCacheScope, session.baseUrl, text(profile.role), text(profile.ref), hash >>> 0]),
    };
  } catch {
    return null;
  }
}
