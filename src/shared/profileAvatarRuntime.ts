import { activeSessionToken, registerSessionResetHook, type Session } from '../auth';
import { profileAvatarSource } from '../profileModel';
import { ProfileAvatarCache } from './profileAvatarCache';

const cache = new ProfileAvatarCache();
registerSessionResetHook(async () => { cache.clear(); });

const account = (session: Session, profile: Record<string, unknown>) => ({ baseUrl: session.baseUrl, profile });
const download = async (session: Session, profile: Record<string, unknown>) => {
  const source = profileAvatarSource(session, profile);
  if (!source || !activeSessionToken(session)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(source.uri, { method: 'GET', signal: controller.signal, credentials: 'omit' });
    if (response.status !== 200) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!activeSessionToken(session) || !bytes.length) return null;
    return { bytes, mime: response.headers.get('content-type')?.split(';')[0] };
  } finally { clearTimeout(timer); }
};

export function cachedProfileAvatar(session: Session, profile: Record<string, unknown>): string | null {
  return cache.get(account(session, profile));
}
export function cacheProfileAvatarBytes(session: Session, profile: Record<string, unknown>, bytes: Uint8Array): string | null {
  return cache.remember(account(session, profile), bytes);
}
export function ensureProfileAvatar(session: Session, profile: Record<string, unknown>): Promise<string | null> {
  return cache.ensure(account(session, profile), () => download(session, profile));
}
export function refreshProfileAvatar(session: Session, profile: Record<string, unknown>): Promise<string | null> {
  return cache.refresh(account(session, profile), () => download(session, profile));
}
