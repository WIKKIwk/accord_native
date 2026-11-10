import { useEffect, useReducer, useState } from 'react';
import { captureSessionWitness, currentSession, isSessionWitnessCurrent, subscribeSessionWitness } from '../auth';
import { adminApparatus } from '../apparatusApi';
import { sessionReadScope } from '../sessionReadScope';
import { assignedPaddonApparatus } from '../rezka/rezkaPaddonScope';
import type { RoleDrawerItem } from '../shared/navigation/roleDrawerModel';
import { useWorkerOrderText } from './useWorkerOrderText';

/** @v2 _AparatchiNavigationDrawerState._loadApparatus */
export function useWorkerPaddonNavigation(visible: boolean): RoleDrawerItem[] {
  const [revision, refresh] = useReducer(value => value + 1, 0), session = currentSession(), scope = session ? sessionReadScope(session) : '';
  const { p } = useWorkerOrderText();
  const [loaded, setLoaded] = useState<{ scope: string; current(): boolean; items: { id: string; name: string }[] } | null>(null);
  useEffect(() => subscribeSessionWitness(refresh), []);
  useEffect(() => {
    if (!visible || !session || session.profile.role !== 'aparatchi' || !session.assigned_apparatus.length) return;
    const witness = captureSessionWitness(session); let alive = true;
    const current = () => alive && isSessionWitnessCurrent(witness) && sessionReadScope(session) === scope;
    void adminApparatus(session, { limit: 10000, beforeSend: () => { if (!current()) throw Error('session_scope_changed'); }, readWitness: current })
      .then(rows => { if (current()) setLoaded({ scope, current: () => isSessionWitnessCurrent(witness) && sessionReadScope(session) === scope,
        items: assignedPaddonApparatus(rows, session.assigned_apparatus) }); }).catch(() => { if (current()) setLoaded(null); });
    return () => { alive = false; };
  }, [visible, session, scope, revision]);
  return loaded?.scope === scope && loaded.current() ? loaded.items.map(row => ({ id: `paddons:${row.id}`, label: p('worker.paddon.apparatus', { apparatus: row.name }),
    symbol: { ios: 'shippingbox', android: 'pallet' } })) : [];
}
