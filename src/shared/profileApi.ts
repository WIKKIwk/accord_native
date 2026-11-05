import { saveSession, type Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { profileFromLogin } from '../authenticateAccount';

async function updateSessionProfile(session: Session, value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid profile');
  const row = value as Record<string, unknown>;
  const profile = profileFromLogin({ profile: row,
    capabilities: Array.isArray(row.capabilities) ? row.capabilities : [],
    assigned_apparatus: Array.isArray(row.assigned_apparatus) ? row.assigned_apparatus : [],
    assigned_apparatus_labels: row.assigned_apparatus_labels,
    assigned_item_groups: Array.isArray(row.assigned_item_groups) ? row.assigned_item_groups : [],
    assigned_warehouses: Array.isArray(row.assigned_warehouses) ? row.assigned_warehouses : [],
  });
  session.profile = profile;
  session.capabilities = profile.capabilities;
  session.assigned_apparatus = profile.assigned_apparatus;
  session.assigned_apparatus_labels = profile.assigned_apparatus_labels;
  session.assigned_item_groups = profile.assigned_item_groups;
  session.assigned_warehouses = profile.assigned_warehouses;
  await saveSession(session);
  return profile;
}

/** @v2 updateNickname */
export async function updateNickname(session: Session, nickname: string) {
  const response = await authorizedFetch(session, '/v1/mobile/profile', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nickname }),
  });
  if (response.status !== 200) throw new Error('Nickname update failed');
  return updateSessionProfile(session, await response.json());
}

/** @v2 uploadAvatar */
export async function uploadAvatar(session: Session, bytes: readonly number[] | Uint8Array, filename: string) {
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
  const response = await authorizedFetch(session, '/v1/mobile/profile/avatar', {
    method: 'POST', headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` }, body,
  });
  if (response.status !== 200) throw new Error('Avatar upload failed');
  return updateSessionProfile(session, await response.json());
}
