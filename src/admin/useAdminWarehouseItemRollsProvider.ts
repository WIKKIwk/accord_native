import { useIsFocused } from 'expo-router';
import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { subscribeSessionWitness, type Session, type SessionWitness } from '../auth';
import { adminText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { readAdminWarehouseItemRolls } from './adminWarehouseItemRollsApi';
import { adminWarehouseItemRollsAuthority } from './adminWarehouseItemRollsAuthority';
import { AdminWarehouseItemRollsController } from './adminWarehouseItemRollsController';
import { adminWarehouseItemRollRows } from './adminWarehouseItemRollsModel';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener), getLocale = () => localeController.locale;
/** Held parent wiring uses provider.open as Main.onItemRolls, and renders the native Sheet alongside Main. */
export function useAdminWarehouseItemRollsProvider(session: Session, witness: SessionWitness, isCurrent: () => boolean) {
  const focused = useIsFocused(), focus = useRef(focused);
  const owner = useMemo(() => {
    const current = adminWarehouseItemRollsAuthority(session, witness, isCurrent);
    return { current, controller: new AdminWarehouseItemRollsController({ current, read: (item, guard, readWitness) => readAdminWarehouseItemRolls(session, item, guard, readWitness) }) };
  }, [session, witness, isCurrent]);
  const state = useSyncExternalStore(owner.controller.subscribe, owner.controller.getSnapshot, owner.controller.getSnapshot), locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale);
  useLayoutEffect(() => { focus.current = focused; return () => { focus.current = false; }; }, [focused]);
  useLayoutEffect(() => { const check = () => { if (!owner.current()) owner.controller.invalidate(); }; const unsubscribe = subscribeSessionWitness(check); owner.controller.start(); check(); return () => { unsubscribe(); owner.controller.dispose(); }; }, [owner]);
  const a = useMemo(() => (key: string) => adminText(key, locale), [locale]);
  const rolls = state.presentation?.rolls;
  const rows = useMemo(() => adminWarehouseItemRollRows(rolls ?? [], a), [rolls, a]);
  const presentation = state.presentation, controller = owner.controller;
  return { state, presentation, a, rows, open: controller.open,
    active: !!presentation && state.valid && owner.current(),
    showDetails: (roll: Parameters<typeof controller.showDetails>[1]) => { if (focus.current && presentation && controller.currentPresentation(presentation.id)) controller.showDetails(presentation.id, roll); },
    beginDismiss: () => { if (presentation) controller.beginDismiss(presentation.id); }, close: () => { if (presentation) controller.close(presentation.id); },
    dismissDetails: (id: number, completed: boolean) => { if (presentation) controller.dismissDetails(presentation.id, id, completed); },
  };
}
export type AdminWarehouseItemRollsProviderModel = ReturnType<typeof useAdminWarehouseItemRollsProvider>;
