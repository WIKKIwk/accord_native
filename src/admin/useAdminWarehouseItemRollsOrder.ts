import { useIsFocused } from 'expo-router';
import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { subscribeSessionWitness, type Session, type SessionWitness } from '../auth';
import { adminText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { adminWarehouseItemRollsAuthority } from './adminWarehouseItemRollsAuthority';
import { readAdminWarehouseItemRollsOrder } from './adminWarehouseItemRollsApi';
import { AdminWarehouseItemRollsOrderController } from './adminWarehouseItemRollsOrder';
import { dartTrim } from './dartJsonString';

export type AdminWarehouseItemRollsOrderProps = { session: Session; witness: SessionWitness; isCurrent: () => boolean; orderId: string };
const subscribeLocale = (listener: () => void) => localeController.addListener(listener), getLocale = () => localeController.locale;
export function useAdminWarehouseItemRollsOrder({ session, witness, isCurrent, orderId }: AdminWarehouseItemRollsOrderProps) {
  const focused = useIsFocused(), focus = useRef(focused), owner = useMemo(() => {
    const current = adminWarehouseItemRollsAuthority(session, witness, isCurrent);
    return { current, controller: new AdminWarehouseItemRollsOrderController({ current, read: (guard, readWitness) => readAdminWarehouseItemRollsOrder(session, orderId, guard, readWitness) }) };
  }, [session, witness, isCurrent, orderId]);
  const state = useSyncExternalStore(owner.controller.subscribe, owner.controller.getSnapshot, owner.controller.getSnapshot), locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale);
  useLayoutEffect(() => { focus.current = focused; return () => { focus.current = false; }; }, [focused]);
  useLayoutEffect(() => { const check = () => { if (!owner.current()) owner.controller.invalidate(); }; const unsubscribe = subscribeSessionWitness(check); owner.controller.start(); check(); return () => { unsubscribe(); owner.controller.dispose(); }; }, [owner]);
  const a = (key: string, values?: Record<string, unknown>) => adminText(key, locale, values), order = state.order?.map, generation = owner.controller.generation;
  return { state, a, current: state.phase !== 'invalid' && owner.current(),
    lines: order ? [{ label: a('warehouse.reservation_reason'), value: a('warehouse.reservation_for_order', { order: dartTrim(order.title) ? order.title : order.id }) },
      ...(dartTrim(order.customer_name) ? [{ label: a('label.customer'), value: order.customer_name }] : [])] : [],
    retry: () => { if (focus.current && owner.controller.current(generation)) void owner.controller.load(); } };
}
