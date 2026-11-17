import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { parseGScaleModeArgs } from '../gscale/gscaleRouteArgs';
import { useRoleDrawer } from '../shared/navigation/roleDrawerContext';
import { useMaterialContext } from './MaterialContext';
import { materialReceiptCurrent } from './materialReceiptAccess';

/** @v2 GScaleModeScreen: reuse the same receipt operator used by Preparation. */
export function useMaterialReceipt() {
  const { session, witness, onLogout } = useMaterialContext(), drawer = useRoleDrawer();
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const params = useLocalSearchParams(), key = JSON.stringify(params);
  const args = useMemo(() => {
    try { return parseGScaleModeArgs(JSON.parse(key)); } catch { return null; }
  }, [key]);
  const isCurrent = useCallback(() => mounted.current && materialReceiptCurrent(session, witness), [session, witness]);
  const materialReceipt = useMemo(() => ({ isCurrent, onMenu: drawer.open,
    onProfile: () => { if (isCurrent()) router.navigate(`/${Platform.OS === 'ios' ? 'ios' : 'android'}-material/profile` as Href); },
  }), [drawer.open, isCurrent]);
  return { session, args, onLogout, materialReceipt, allowed: materialReceiptCurrent(session, witness) };
}
