import { useEffect } from 'react';
import { captureSessionWitness, isSessionWitnessCurrent, activeSessionEpoch, type Session, type SessionWitness } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { adminSequenceApparatusStore } from '../shared/adminSequenceApparatusStore';
import { productionSnapshotStore } from '../shared/productionSnapshotRuntime';
import { readSupplyTaskWindow } from '../shared/supplyTasks/supplyTaskApi';
import { MaterialTasksWarmStore } from './materialTasksWarmStore';

const stores = new WeakMap<Session, { current(): boolean; store: MaterialTasksWarmStore }>();
const prepared = new WeakMap<Session, string>();
/** @v2 SupplyTasksWarmStore.prepare: one optional preload; no socket or polling. */
export function useMaterialTasksWarmup(session: Session, witness: SessionWitness) {
  const owner = JSON.stringify([sessionReadScope(session), activeSessionEpoch(session), session.token, productionSnapshotStore.generation]);
  useEffect(() => {
    if (session.profile.role !== 'material_taminotchi' || session.token === 'test-mode-token' || !session.capabilities.includes('raw_material.assign') ||
      !isSessionWitnessCurrent(witness) || prepared.get(session) === owner) return;
    prepared.set(session, owner);
    const current = () => isSessionWitnessCurrent(witness);
    void adminSequenceApparatusStore.loadSavedApparatusId().then(apparatus => {
      if (current()) return materialTasksWarmStore(session).read({ kind: 'material', apparatus: apparatus ?? '', limit: 10, search: '' }, current);
    }).catch(() => {});
  }, [session, witness, owner]);
}
export function materialTasksWarmStore(session: Session) {
  const previous = stores.get(session); if (previous?.current()) return previous.store;
  const witness = captureSessionWitness(session), current = () => isSessionWitnessCurrent(witness);
  const store = new MaterialTasksWarmStore(session, productionSnapshotStore, (query, guard) => readSupplyTaskWindow(session, query, guard), current);
  stores.set(session, { current, store }); return store;
}
