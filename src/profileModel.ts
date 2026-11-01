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

function labels(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
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
  const name = text(profile.display_name) || text(profile.legal_name) || 'Foydalanuvchi';
  const legalName = text(profile.legal_name);
  return {
    name,
    role: roleLabels[role] ?? 'Foydalanuvchi',
    phone: text(profile.phone),
    legalName: legalName && legalName !== name ? legalName : '',
    apparatusLabels: snapshot.apparatusLabels,
  };
}

/** Use only the active server's avatar endpoint; never use a token from avatar_url. */
export function profileAvatarSource(session: Session, profile: Record<string, unknown>) {
  const rawAvatar = text(profile.avatar_url);
  if (!rawAvatar) return null;
  try {
    const base = new URL(session.baseUrl);
    if (base.protocol !== 'https:' || base.origin !== session.baseUrl) return null;
    const uri = new URL('/v1/mobile/profile/avatar/view', base.origin);
    let version = '';
    try { version = new URL(rawAvatar, base.origin).searchParams.get('v') ?? ''; } catch { /* Use the current avatar. */ }
    if (version) uri.searchParams.set('v', version);
    return {
      uri: uri.toString(),
      cacheKey: JSON.stringify(['profile-avatar', session.imageCacheScope, base.origin, text(profile.role), text(profile.ref), version]),
    };
  } catch {
    return null;
  }
}
