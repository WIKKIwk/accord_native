import { activeSessionToken, registerSessionResetHook, type Session } from '../auth';
import { qolipCatalogDetails, qolipCatalogPage, qolipProductFromJson } from '../qolipCatalogApi';
import { sessionReadScope } from '../sessionReadScope';
import { QolipCatalogStore } from './qolipCatalogStore';

let current: { session: Session; store: QolipCatalogStore; unregister: () => void } | null = null;

export function qolipCatalogRuntimeFor(session: Session): QolipCatalogStore {
  if (current?.session === session) return current.store;
  if (current) { current.unregister(); current.store.reset(); current = null; }
  const scope = () => sessionReadScope(session);
  const store = new QolipCatalogStore({ scope: () => JSON.stringify([scope(), activeSessionToken(session) === 'test-mode-token']),
    requestScope: scope, page: (query, cursor) => qolipCatalogPage(session, { query, cursor }),
    details: id => qolipCatalogDetails(session, id), parseProduct: qolipProductFromJson });
  const unregister = registerSessionResetHook(async () => {
    store.reset();
    if (current?.store === store) { current.unregister(); current = null; }
  });
  current = { session, store, unregister }; return store;
}
