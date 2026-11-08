import { saveSession, type Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { profileFromLogin } from '../authenticateAccount';
import { assertProfileIdentity, assertProfileSessionCurrent, type ProfileSessionGuard } from './profileSessionGuard';

async function updateSessionProfile(session: Session, value: unknown, check?: () => void) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid profile');
  const row = value as Record<string, unknown>;
  const profile = profileFromLogin({ profile: row,
    capabilities: Array.isArray(row.capabilities) ? row.capabilities : [],
    assigned_apparatus: Array.isArray(row.assigned_apparatus) ? row.assigned_apparatus : [],
    assigned_apparatus_labels: row.assigned_apparatus_labels,
    assigned_item_groups: Array.isArray(row.assigned_item_groups) ? row.assigned_item_groups : [],
    assigned_warehouses: Array.isArray(row.assigned_warehouses) ? row.assigned_warehouses : [],
  });
  check?.();
  if (check) assertProfileIdentity(session, profile);
  session.profile = profile;
  session.capabilities = profile.capabilities;
  session.assigned_apparatus = profile.assigned_apparatus;
  session.assigned_apparatus_labels = profile.assigned_apparatus_labels;
  session.assigned_item_groups = profile.assigned_item_groups;
  session.assigned_warehouses = profile.assigned_warehouses;
  await saveSession(session);
  check?.();
  return profile;
}

/** @v2 updateNickname */
export async function updateNickname(session: Session, nickname: string, signal?: AbortSignal, isCurrent?: ProfileSessionGuard) {
  const check = isCurrent == null ? undefined : () => assertProfileSessionCurrent(isCurrent); check?.();
  const init: RequestInit = { method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname }), ...(signal ? { signal } : {}) };
  const response = check ? await authorizedFetch(session, '/v1/mobile/profile', init, check)
    : await authorizedFetch(session, '/v1/mobile/profile', init);
  check?.();
  if (response.status !== 200) throw new Error('Nickname update failed');
  const value: unknown = await response.json(); check?.();
  return updateSessionProfile(session, value, check);
}

/** @v2 uploadAvatar */
export async function uploadAvatar(session: Session, bytes: readonly number[] | Uint8Array, filename: string, signal?: AbortSignal, isCurrent?: ProfileSessionGuard) {
  const check = isCurrent == null ? undefined : () => assertProfileSessionCurrent(isCurrent); check?.();
  // Match package:http's multipart file headers and preserve the original bytes on native and web.
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let boundary = 'dart-http-boundary-';
  while (boundary.length < 70) boundary += chars[Math.floor(Math.random() * chars.length)];
  const encodedName = filename.replace(/\r\n|\r|\n/g, '%0D%0A').replace(/"/g, '%22');
  const encoder = new TextEncoder();
  const head = encoder.encode(`--${boundary}\r\ncontent-type: application/octet-stream\r\ncontent-disposition: form-data; name="avatar"; filename="${encodedName}"\r\n\r\n`);
  const tail = encoder.encode(`\r\n--${boundary}--\r\n`);
  const content = Uint8Array.from(bytes), body = new Uint8Array(head.length + content.length + tail.length);
  body.set(head); body.set(content, head.length); body.set(tail, head.length + content.length);
  const init: RequestInit = { method: 'POST', headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` }, body, ...(signal ? { signal } : {}) };
  const response = await authorizedFetch(session, '/v1/mobile/profile/avatar', init, check, null);
  check?.();
  if (response.status !== 200) throw new Error('Avatar upload failed');
  const value: unknown = await response.json(); check?.();
  return updateSessionProfile(session, value, check);
}
