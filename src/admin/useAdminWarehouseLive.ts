import { useEffect, useMemo } from 'react';
import { subscribeSessionWitness, type Session, type SessionWitness } from '../auth';
import { AdminWarehouseLiveController } from './adminWarehouseLiveController';
import { adminWarehouseLiveCurrent, openAdminWarehouseLive } from './adminWarehouseLiveTransport';

/** The eventual real Warehouse owner supplies its source _load/refresh callback. */
export function useAdminWarehouseLive(session: Session, witness: SessionWitness, isCurrent: () => boolean, refresh: () => Promise<void>) {
  const owner = useMemo(() => {
    const current = adminWarehouseLiveCurrent(session, witness, isCurrent);
    return { current, controller: new AdminWarehouseLiveController({ isCurrent: current,
      warehouseScoped: session.profile.role === 'werka' || session.profile.role === 'material_taminotchi',
      connect: callbacks => openAdminWarehouseLive(session, current, callbacks), refresh }) };
  }, [session, witness, isCurrent, refresh]);
  useEffect(() => {
    const unsubscribe = subscribeSessionWitness(() => { if (!owner.current()) owner.controller.dispose(); });
    owner.controller.start();
    return () => { unsubscribe(); owner.controller.dispose(); };
  }, [owner]);
}
