import { activeSessionToken, type Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { qolipProductFromJson } from '../qolipCatalogApi';
import { assertQolipReadCurrent, dartQuery, jsonObject, qolipApiResponseError, trimDart, type QolipReadGuard } from './qolipApiCommon';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';
import { qolipRoleReadBoundary } from './qolipRoleReadBoundary';

type Product = Readonly<ReturnType<typeof qolipProductFromJson>>;
export type QolipCatalogReadItem = Readonly<{ id: string; name: string; order_image_order_id: string }>;
export type QolipCatalogReadPage = Readonly<{ items: readonly QolipCatalogReadItem[]; next_cursor: string | null }>;
export type QolipCatalogReadInput = Readonly<{ query?: string; cursor?: string | null; limit?: number }>;

/**
 * Role-local, uncached GET adapter. The owner must subscribe to its original boundary and supply
 * a non-revivable per-run guard on every call. This never captures a witness or owns the shared store.
 */
export function createQolipCatalogReaders(session: Session, originalBoundary: QolipHomeReadBoundary) {
  const boundary = qolipRoleReadBoundary(session, originalBoundary), roleCurrent = () => boundary.current();
  function composeGuard(lifetime: QolipReadGuard): QolipReadGuard {
    if (typeof lifetime !== 'function') throw new Error('qolip_read_expired');
    let expired = false;
    return () => {
      if (expired) return false;
      try {
        assertQolipReadCurrent(roleCurrent); assertQolipReadCurrent(lifetime);
        assertQolipReadCurrent(roleCurrent); assertQolipReadCurrent(lifetime);
        return !expired;
      } catch { expired = true; return false; }
    };
  }
  async function send(path: string, guard: QolipReadGuard): Promise<Response> {
    assertQolipReadCurrent(guard);
    await Promise.resolve();
    const beforeSend = () => {
      assertQolipReadCurrent(guard);
      if (activeSessionToken(session) === 'test-mode-token') throw new Error('Qolip test mode is not yet ported');
    };
    return authorizedFetch(session, path, {}, beforeSend);
  }
  async function data(path: string, guard: QolipReadGuard): Promise<Record<string, unknown>> {
    const response = await send(path, guard);
    assertQolipReadCurrent(guard);
    const status = response.status;
    assertQolipReadCurrent(guard);
    if (status !== 200) {
      const error = await qolipApiResponseError(response, 'qolip_products_failed', 'Qoliplar yuklanmadi');
      assertQolipReadCurrent(guard); throw error;
    }
    const result = jsonObject(await response.json());
    assertQolipReadCurrent(guard);
    if (!result) throw new TypeError('Expected JSON object');
    return result;
  }
  async function guarded<T>(guard: QolipReadGuard, read: () => Promise<T>): Promise<T> {
    try { assertQolipReadCurrent(guard); const result = await read(); assertQolipReadCurrent(guard); return result; }
    catch (error) { assertQolipReadCurrent(guard); throw error; }
  }
  return Object.freeze({
    /** Source page contract, without touching or updating the shared account-scoped catalog cache. */
    page(input: QolipCatalogReadInput, lifetime: QolipReadGuard): Promise<QolipCatalogReadPage> {
      const guard = composeGuard(lifetime);
      return guarded(guard, async () => {
        const requested = input.limit ?? 200;
        if (!Number.isInteger(requested)) throw new TypeError('Invalid Qolip catalog limit');
        const limit = Math.max(1, Math.min(200, requested)), query = trimDart(input.query ?? ''), cursor = input.cursor ?? null;
        const parameters: Record<string, string> = { limit: String(limit) };
        if (query) parameters.q = query;
        if (cursor !== null) parameters.cursor = cursor;
        assertQolipReadCurrent(guard);
        const result = await data(`/v1/mobile/qolip/products/page?${dartQuery(parameters)}`, guard);
        const raw = result.items, hasMore = result.has_more, next = result.next_cursor;
        assertQolipReadCurrent(guard);
        if (!Array.isArray(raw) || raw.length > limit || typeof hasMore !== 'boolean' ||
            (hasMore && (!raw.length || typeof next !== 'string' || !next || next === cursor))) {
          throw new TypeError('Invalid Qolip catalog page');
        }
        const ids = new Set<string>(), items: QolipCatalogReadItem[] = [];
        for (const value of raw) {
          const row = jsonObject(value), id = row?.id, name = row?.name, image = row?.order_image_order_id;
          assertQolipReadCurrent(guard);
          if (typeof id !== 'string' || !id || ids.has(id) || typeof name !== 'string' || (image != null && typeof image !== 'string')) {
            throw new TypeError('Invalid Qolip catalog item');
          }
          ids.add(id); items.push(Object.freeze({ id, name, order_image_order_id: trimDart(image ?? '') }));
        }
        assertQolipReadCurrent(guard);
        return Object.freeze({ items: Object.freeze(items), next_cursor: hasMore ? next as string : null });
      });
    },
    /** Source detail contract; the raw ID is preserved rather than trimmed. */
    details(id: string, lifetime: QolipReadGuard): Promise<readonly Product[]> {
      const guard = composeGuard(lifetime);
      return guarded(guard, async () => {
        const result = await data(`/v1/mobile/qolip/products/detail?${dartQuery({ id })}`, guard), raw = result.products;
        assertQolipReadCurrent(guard);
        if (!Array.isArray(raw) || !raw.length) throw new TypeError('Missing Qolip product details');
        const products = raw.map(value => Object.freeze(qolipProductFromJson(value)));
        assertQolipReadCurrent(guard); return Object.freeze(products);
      });
    },
  });
}
