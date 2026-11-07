import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { registerSessionResetHook, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { preparationMaterialStock } from './preparationMaterialStockApi';
import { PreparationMaterialStockState } from './preparationMaterialStockState';

export function usePreparationMaterialStock(session: Session, warehouse: string, code: string) {
  const controller = useMemo(() => {
    const scope = sessionReadScope(session);
    return new PreparationMaterialStockState((tab, offset) => preparationMaterialStock(session, warehouse, code, tab, offset), () => scope === sessionReadScope(session));
  }, [session, warehouse, code]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    controller.activate();
    const unregister = registerSessionResetHook(async () => { controller.invalidate(); });
    return () => { unregister(); controller.dispose(); };
  }, [controller]);
  useFocusEffect(useCallback(() => { controller.activate(); void controller.reload(); }, [controller]));
  return { ...state, controller };
}
