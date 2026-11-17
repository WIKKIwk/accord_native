import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { subscribeSessionWitness, type Session, type SessionWitness } from '../auth';
import { adminText, localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import type { AdminInactiveSupplier } from './adminInactiveSuppliersApi';
import { createAdminInactiveSuppliersSession } from './adminInactiveSuppliersSession';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
export function useAdminInactiveSuppliers({ session, witness, isCurrent }: {
  session: Session; witness: SessionWitness; isCurrent: () => boolean;
}) {
  const owner = useMemo(() => createAdminInactiveSuppliersSession(session, witness, isCurrent), [session, witness, isCurrent]);
  const state = useSyncExternalStore(owner.controller.subscribe, owner.controller.getSnapshot, owner.controller.getSnapshot);
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  useEffect(() => {
    owner.controller.start();
    const check = () => { if (!owner.current()) owner.controller.invalidate(); };
    const unsubscribe = subscribeSessionWitness(check); check();
    return () => { unsubscribe(); owner.controller.stop(); };
  }, [owner]);
  // Source mutations do not invent an error/success notice. List failures use retry.
  const handle = async (operation: Promise<unknown>): Promise<void> => { try { await operation; } catch { /* The source has no mutation-failure notice. */ } };
  return { state, current: owner.current(), a: (key: string) => adminText(key, locale), t: (key: string) => localizedGetter(key, locale),
    reload: () => handle(owner.controller.reload()), restore: (item: AdminInactiveSupplier) => handle(owner.controller.restore(item)),
    unblock: (item: AdminInactiveSupplier) => handle(owner.controller.unblock(item)) };
}
