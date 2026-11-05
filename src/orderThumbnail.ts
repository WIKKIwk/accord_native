import { activeSessionToken, type Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { adminProductionMapOrderImageUrl, orderImageRequestUri } from './orderImageUri';

const missing = new WeakMap<Session, Map<string, number>>();
const checks = new WeakMap<Session, Map<string, Promise<boolean>>>();
const waiting: (() => void)[] = [];
let running = 0;

function imageKey(orderId: string, imageId: string): string {
  return JSON.stringify([orderId, imageId]);
}

function thumbnailPath(session: Session, orderId: string, imageId: string): string {
  const url = orderImageRequestUri(session.baseUrl, adminProductionMapOrderImageUrl(session.baseUrl, orderId, imageId), true);
  return `${url.pathname}${url.search}`;
}

export function thumbnailSource(session: Session, orderId: string, imageId: string) {
  const url = new URL(thumbnailPath(session, orderId, imageId), session.baseUrl);
  if (!orderId || url.protocol !== 'https:' || url.origin !== session.baseUrl) return null;
  const freshness = Math.floor(Date.now() / (imageId ? 86400000 : 30000));
  return {
    uri: url.toString(),
    cacheKey: JSON.stringify(['order-thumbnail', session.imageCacheScope, session.baseUrl, orderId, imageId, freshness]),
  };
}

export function isThumbnailMissing(session: Session, orderId: string, imageId: string): boolean {
  const entries = missing.get(session);
  const key = imageKey(orderId, imageId);
  const expires = entries?.get(key) ?? 0;
  if (expires > Date.now()) return true;
  entries?.delete(key);
  return false;
}

/** Limit native image requests and release a slot on completion or unmount. */
export function scheduleThumbnail(start: (finish: () => void) => void): () => void {
  let started = false;
  let finished = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const finish = () => {
    if (finished) return;
    finished = true;
    if (timeout) clearTimeout(timeout);
    if (!started) {
      const index = waiting.indexOf(run);
      if (index !== -1) waiting.splice(index, 1);
      return;
    }
    const next = waiting.shift();
    if (next) next(); else running--;
  };
  const run = () => {
    started = true;
    timeout = setTimeout(finish, 15000);
    start(finish);
  };
  if (running < 4) { running++; run(); } else waiting.push(run);
  return finish;
}

/** expo-image errors lack HTTP status. Check failed loads through the usual auth retry. */
export function retryThumbnail(session: Session, orderId: string, imageId: string, failedToken: string): Promise<boolean> {
  const token = activeSessionToken(session);
  if (!token) return Promise.resolve(false);
  if (token !== failedToken) return Promise.resolve(true);
  let pending = checks.get(session);
  if (!pending) { pending = new Map(); checks.set(session, pending); }
  const key = imageKey(orderId, imageId);
  const existing = pending.get(key);
  if (existing) return existing;
  const current = pending;
  const request = new Promise<boolean>(resolve => {
    scheduleThumbnail(finish => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      void authorizedFetch(session, thumbnailPath(session, orderId, imageId), { signal: controller.signal })
        .then(response => {
          if (!activeSessionToken(session)) return false;
          if (response.status === 404) {
            let entries = missing.get(session);
            if (!entries) { entries = new Map(); missing.set(session, entries); }
            entries.set(key, Date.now() + 15000);
            while (entries.size > 96) entries.delete(entries.keys().next().value!);
          }
          return response.ok;
        })
        .catch(() => false)
        .then(resolve)
        .finally(() => { clearTimeout(timeout); finish(); });
    });
  }).finally(() => { current.delete(key); });
  current.set(key, request);
  return request;
}
