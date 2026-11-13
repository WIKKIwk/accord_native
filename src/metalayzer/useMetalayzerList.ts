import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { captureSessionWitness, isSessionWitnessCurrent } from '../auth';
import { useMetalayzerContext } from './MetalayzerContext';
import { metalayzerMaterials, metalayzerScope } from './metalayzerApi';
import { MetalayzerListState } from './metalayzerListState';

export function useMetalayzerList() {
  const { session } = useMetalayzerContext();
  const controller = useMemo(() => {
    const witness = captureSessionWitness(session);
    let scope = '';
    try { scope = metalayzerScope(session); } catch { /* Fail closed until a valid session is opened. */ }
    const isCurrent = () => {
      try { return !!scope && isSessionWitnessCurrent(witness) && metalayzerScope(session) === scope; } catch { return false; }
    };
    return new MetalayzerListState({ isCurrent, page: (cursor, current) => metalayzerMaterials(session, cursor, witness, current) });
  }, [session]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useFocusEffect(useCallback(() => {
    controller.activate(); void controller.reload();
    return () => controller.invalidate();
  }, [controller]));
  return { ...state, reload: () => controller.reload(), loadMore: () => controller.loadMore() };
}
