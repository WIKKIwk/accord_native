import type { Session } from '../auth';

type Account = { server: string; role: string; ref: string };

/** V4 security scope: legacy V2 actor/request keys have no trustworthy server provenance. */
export function boyoqchiDraftAccount(session: Session): Account {
  const base = session.baseUrl.trim();
  let url: URL;
  try { url = new URL(base); } catch { throw new Error('Invalid draft account scope'); }
  const role = typeof session.profile?.role === 'string' ? session.profile.role.trim() : '';
  const ref = typeof session.profile?.ref === 'string' ? session.profile.ref.trim() : '';
  if (url.protocol !== 'https:' || url.username || url.password || (url.pathname !== '/' && url.pathname !== '') || url.search || url.hash || !role || !ref) {
    throw new Error('Invalid draft account scope');
  }
  return { server: url.origin, role, ref };
}
export function boyoqchiDraftKey(account: Account, requestId: string): string {
  const request = requestId.trim();
  if (!request) throw new Error('Invalid draft request scope');
  return JSON.stringify(['boyoqchi-private-draft-v2', account.server, account.role, account.ref, request]);
}
export function boyoqchiDraftAccountKey(account: Account): string {
  return JSON.stringify([account.server, account.role, account.ref]);
}
