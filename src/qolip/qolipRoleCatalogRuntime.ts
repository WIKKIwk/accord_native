import type { Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { qolipProductFromJson } from '../qolipCatalogApi';
import { QolipCatalogStore } from '../shared/qolipCatalogStore';
import { bindQolipCatalogRuntime } from '../shared/qolipCatalogRuntime';
import { createQolipCatalogReaders } from './qolipCatalogReadApi';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';

const stores = new WeakMap<QolipHomeReadBoundary, { session: Session; store: QolipCatalogStore }>();
const owners = new Map<Session, { boundary: QolipHomeReadBoundary; store: QolipCatalogStore }>();
/** The existing source-equivalent catalog store, bound to this role's original witness. */
export function qolipRoleCatalogRuntimeFor(session: Session, boundary: QolipHomeReadBoundary): QolipCatalogStore {
  const cached = stores.get(boundary); if (cached?.session === session) { bindQolipCatalogRuntime(session, cached.store); return cached.store; }
  const readers = createQolipCatalogReaders(session, boundary), current = () => boundary.current();
  const store = new QolipCatalogStore({ scope: () => JSON.stringify([sessionReadScope(session), current()]), requestScope: () => sessionReadScope(session),
    page: async (query, cursor) => { const page = await readers.page({ query, cursor }, current); return { items: [...page.items], next_cursor: page.next_cursor }; },
    details: async id => [...await readers.details(id, current)], parseProduct: qolipProductFromJson });
  stores.set(boundary, { session, store }); owners.set(session, { boundary, store });
  bindQolipCatalogRuntime(session, store);
  let stop: (() => void) | null = null;
  stop = boundary.subscribe(() => { if (!current()) { store.reset(); if (owners.get(session)?.store === store) owners.delete(session); stop?.(); stop = null; } });
  return store;
}
