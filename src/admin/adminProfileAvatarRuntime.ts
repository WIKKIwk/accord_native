import { registerSessionResetHook } from '../auth';
import { readAdminProfileAvatar } from './adminProfileAvatarApi';
import { AdminProfileAvatarCache } from './adminProfileAvatarCache';
import { checkedAdminGuard } from './adminProductionRequest';

const cache = new AdminProfileAvatarCache();
registerSessionResetHook(async () => { cache.clear(); });
export function cachedAdminProfileAvatar(scope: string, url: string, guard: () => void): string | null { const check = checkedAdminGuard(guard)!; check(); const value = cache.get(scope, url); check(); return value; }
export async function loadAdminProfileAvatar(scope: string, url: string, guard: () => void, signal: AbortSignal): Promise<string | null> {
  const checked = checkedAdminGuard(guard)!, check = () => { checked(); if (signal.aborted) throw Error('Admin avatar request closed'); };
  check(); const revision = cache.revision, existing = cache.get(scope, url); check(); if (existing) return existing;
  const image = await readAdminProfileAvatar(url, check, signal); check();
  if (signal.aborted || revision !== cache.revision || !image) return null;
  const result = cache.remember(scope, url, image.bytes, image.mime, revision); check(); return result;
}
export function forgetAdminProfileAvatar(scope: string, url: string, uri: string, guard: () => void): void { const check = checkedAdminGuard(guard)!; check(); cache.forget(scope, url, uri); check(); }
