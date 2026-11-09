import { useCallback, useEffect, useRef } from 'react';
import { isSessionWitnessCurrent, subscribeSessionWitness, type Session, type SessionWitness } from '../auth';
import { useNativeSheet } from '../nativeSheet';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { SupplyTaskRow } from '../shared/supplyTasks/supplyTaskModels';
import { MaterialTaskDetail } from './MaterialTaskDetail';
import { isMaterialTestSession } from './materialTestSession';

export function useMaterialTaskDetail(session: Session, witness: SessionWitness) {
  const sheet = useNativeSheet(), closeActive = useRef<(() => void) | null>(null);
  const authorized = useCallback(() => witness.session === session && !isMaterialTestSession(session) &&
    session.profile.role === 'material_taminotchi' && canOpenRoute(session, appRoutes.materialTasks) && isSessionWitnessCurrent(witness), [session, witness]);
  useEffect(() => {
    const check = () => { if (!authorized()) closeActive.current?.(); };
    const unsubscribe = subscribeSessionWitness(check); check();
    return () => { unsubscribe(); closeActive.current?.(); };
  }, [authorized]);
  return useCallback((row: SupplyTaskRow, selectionCurrent: () => boolean): void | Promise<void> => {
    if (sheet.isOpen() || !authorized() || !isSynchronouslyTrue(selectionCurrent) || !authorized() || !isSynchronouslyTrue(selectionCurrent)) return;
    let live = true, finished = false, resolveDone: () => void = () => {};
    const done = new Promise<void>(resolve => { resolveDone = resolve; });
    const finish = () => { if (finished) return; finished = true; live = false;
      if (closeActive.current === close) closeActive.current = null; resolveDone(); };
    const close = () => { if (!live) return; live = false; sheet.close(); finish(); };
    const current = () => live && authorized();
    closeActive.current = close;
    try {
      sheet.open(<MaterialTaskDetail session={session} witness={witness} row={row} isCurrent={current} onClose={close} />,
        { dismissible: false, onDismiss: finish });
      if (!sheet.isOpen()) finish();
    } catch (error) { finish(); throw error; }
    return done;
  }, [sheet, session, witness, authorized]);
}
