import { activeSessionToken, registerSessionResetHook, type Session } from '../auth';
import { profileAvatarSource } from '../profileModel';
import { ProfileAvatarCache } from './profileAvatarCache';
import { isProfileSessionCurrent, type ProfileSessionGuard } from './profileSessionGuard';

const cache = new ProfileAvatarCache();
registerSessionResetHook(async () => { cache.clear(); });

const account = (session: Session, profile: Record<string, unknown>) => ({ baseUrl: session.baseUrl, profile });
const download = async (session: Session, profile: Record<string, unknown>, isCurrent?: ProfileSessionGuard) => {
  const source = profileAvatarSource(session, profile);
  if (!source || !activeSessionToken(session) || !isProfileSessionCurrent(isCurrent)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(source.uri, { method: 'GET', signal: controller.signal, credentials: 'omit' });
    if (!isProfileSessionCurrent(isCurrent) || response.status !== 200) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!activeSessionToken(session) || !isProfileSessionCurrent(isCurrent) || !bytes.length) return null;
    return { bytes, mime: response.headers.get('content-type')?.split(';')[0] };
  } finally { clearTimeout(timer); }
};

export function cachedProfileAvatar(session: Session, profile: Record<string, unknown>, isCurrent?: ProfileSessionGuard): string | null {
  return isProfileSessionCurrent(isCurrent) ? cache.get(account(session, profile)) : null;
}
export function cacheProfileAvatarBytes(session: Session, profile: Record<string, unknown>, bytes: Uint8Array, isCurrent?: ProfileSessionGuard): string | null {
  return isProfileSessionCurrent(isCurrent) ? cache.remember(account(session, profile), bytes) : null;
}
export function ensureProfileAvatar(session: Session, profile: Record<string, unknown>, isCurrent?: ProfileSessionGuard): Promise<string | null> {
  if (isCurrent == null) return cache.ensure(account(session, profile), () => download(session, profile));
  if (!isProfileSessionCurrent(isCurrent)) return Promise.resolve(null);
  const existing = cache.get(account(session, profile));
  return existing ? Promise.resolve(existing) : cache.refresh(account(session, profile), () => download(session, profile, isCurrent), isCurrent);
}
export function refreshProfileAvatar(session: Session, profile: Record<string, unknown>, isCurrent?: ProfileSessionGuard): Promise<string | null> {
  if (isCurrent == null) return cache.refresh(account(session, profile), () => download(session, profile));
  if (!isProfileSessionCurrent(isCurrent)) return Promise.resolve(null);
  return cache.refresh(account(session, profile), () => download(session, profile, isCurrent), isCurrent);
}
