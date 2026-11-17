import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { isSessionWitnessCurrent } from '../auth';
import { serializeGScaleModeArgs } from '../gscale/gscaleRouteArgs';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import type { SupplyTaskRow } from '../shared/supplyTasks/supplyTaskModels';
import { useMaterialContext } from './MaterialContext';
import { readMaterialTaskDetail } from './materialTaskDetailApi';
import { materialReceiptArgs } from './materialReceiptArgs';

/** @v2 _QolipTasksPageState._add: hydrate before entering the linked-order receipt. */
export function useMaterialTaskReceipt(notice: (message: string) => void) {
  const { session, witness } = useMaterialContext(), mounted = useRef(false);
  const returnToTasks = useRef<{ departed: boolean; resolve(): void } | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; returnToTasks.current?.resolve(); returnToTasks.current = null; }; }, []);
  useFocusEffect(useCallback(() => {
    if (returnToTasks.current?.departed) { returnToTasks.current.resolve(); returnToTasks.current = null; }
    return () => { if (returnToTasks.current) returnToTasks.current.departed = true; };
  }, []));
  return async (row: SupplyTaskRow, selectionCurrent: () => boolean) => {
    const current = () => mounted.current && isSessionWitnessCurrent(witness) && canOpenRoute(session, appRoutes.materialTasks);
    if (!current() || !selectionCurrent()) return;
    try {
      const full = await readMaterialTaskDetail(session, witness, row, current); if (!current()) return;
      const done = new Promise<void>(resolve => { returnToTasks.current = { departed: false, resolve }; });
      try { router.push({ pathname: `/${Platform.OS === 'ios' ? 'ios' : 'android'}-material/receipt`, params: serializeGScaleModeArgs(materialReceiptArgs(full)) } as unknown as Href); }
      catch (error) { returnToTasks.current?.resolve(); returnToTasks.current = null; throw error; }
      await done;
    } catch { if (current()) notice('Material vazifalari yuklanmadi'); }
  };
}
