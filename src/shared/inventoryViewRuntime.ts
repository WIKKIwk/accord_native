import { activeSessionToken, registerSessionResetHook, type Session } from '../auth';
import { inventoryAssets, inventoryLocations, inventoryTransfers, type InventoryAssetsOptions } from '../inventoryReadApi';
import { sessionReadScope } from '../sessionReadScope';
import { InventoryViewStore } from './inventoryViewStore';

let current: { session: Session; store: InventoryViewStore; unregister: () => void } | null = null;

/** Create one shared inventory window store per active session. */
export function inventoryViewRuntimeFor(session: Session): InventoryViewStore {
  if (current?.session === session) return current.store;
  if (current) { current.unregister(); current.store.reset(); current = null; }
  const store = new InventoryViewStore({
    scopeReader: () => sessionReadScope(session),
    tokenReader: () => activeSessionToken(session),
    liveEnabled: () => session.token !== 'test-mode-token',
    snapshotLoader: async query => {
      const p = query.parameters;
      if (query.kind === 'locations') return inventoryLocations(session);
      if (query.kind === 'assets') return inventoryAssets(session, { warehouse_id: p.warehouse_id, query: p.query,
        asset_kind: p.asset_kind as InventoryAssetsOptions['asset_kind'], current_user_states_only: p.current_user_states_only === 'true',
        include_order_assignment: p.include_order_assignment === 'true', limit: Number(p.limit), offset: Number(p.offset ?? 0) });
      return inventoryTransfers(session, { direction: p.direction, status: p.status, limit: Number(p.limit), offset: Number(p.offset ?? 0) });
    },
    liveLoader: (query, version, handlers) => {
      const token = activeSessionToken(session);
      if (!token) throw new Error('No session token');
      const uri = new URL('/v1/mobile/admin/inventory/live', session.baseUrl);
      uri.protocol = uri.protocol === 'https:' ? 'wss:' : 'ws:';
      uri.searchParams.set('token', token.trim());
      uri.searchParams.set('subscriptions', JSON.stringify([query.subscription(version)]));
      const socket = new WebSocket(uri.toString());
      let closed = false;
      socket.onmessage = event => {
        if (closed || typeof event.data !== 'string') return;
        try {
          const message: unknown = JSON.parse(event.data);
          if (!message || typeof message !== 'object' || Array.isArray(message)) throw new TypeError('Invalid live event');
          handlers.message(message as Record<string, unknown>);
        } catch (error) { handlers.error(error); }
      };
      socket.onerror = event => { if (!closed) handlers.error(event); };
      socket.onclose = () => { if (!closed) handlers.done(); };
      return () => { closed = true; socket.close(); };
    },
  });
  const unregister = registerSessionResetHook(async () => {
    store.reset();
    if (current?.store === store) { current.unregister(); current = null; }
  });
  current = { session, store, unregister };
  return store;
}
