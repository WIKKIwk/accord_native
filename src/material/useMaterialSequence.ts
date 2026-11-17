import { useFocusEffect } from 'expo-router';
import { createElement, useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { isSessionWitnessCurrent, subscribeSessionWitness, type Session, type SessionWitness } from '../auth';
import { AdminSequenceApparatusStore } from '../shared/adminSequenceApparatusStore';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { productionText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import type { SupplyTaskRow } from '../shared/supplyTasks/supplyTaskModels';
import { useMaterialContext } from './MaterialContext';
import { readMaterialSequence, readMaterialSequenceApparatus } from './materialSequenceApi';
import { MaterialSequenceController } from './materialSequenceController';
import { subscribeMaterialSequence } from './materialSequenceLive';
import { materialSequenceTone, type MaterialSequenceOrder } from './materialSequenceModel';
import { useMaterialTaskDetail } from './useMaterialTaskDetail';
import { useNativeSheet } from '../nativeSheet';
import { MaterialSequenceAssignment } from './MaterialSequenceAssignment';
import { createMaterialSequenceCache } from './materialSequenceCache';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const getLocale = () => localeController.locale;

function materialSequenceBinding(session: Session, witness: SessionWitness) {
    const current = () => isSessionWitnessCurrent(witness) && session.profile.role === 'material_taminotchi' &&
      session.token !== 'test-mode-token' && canOpenRoute(session, appRoutes.supplySequence);
    const controller = new MaterialSequenceController({ current,
      load: () => readMaterialSequence(session, current),
      loadApparatus: () => readMaterialSequenceApparatus(session, current),
      cache: createMaterialSequenceCache(session, current),
      selection: new AdminSequenceApparatusStore(undefined, () => String(session.profile.ref ?? '')),
      live: (snapshot, apply, recover, error, validated) => subscribeMaterialSequence(session, current, snapshot, apply, recover, error, validated) });
    let mounts = 0, started = false;
    return { controller, current, mount() {
      mounts++; if (!started) { started = true; void controller.start(); }
      return () => { mounts--; queueMicrotask(() => { if (!mounts) controller.dispose(); }); };
    } };
}

export function useMaterialSequence() {
  const { session, witness } = useMaterialContext(), locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale);
  const visible = useRef(true), sheet = useNativeSheet();
  const binding = useMemo(() => materialSequenceBinding(session, witness), [session, witness]);
  const controller = binding.controller, state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const detail = useMaterialTaskDetail(session, witness, appRoutes.supplySequence, state.apparatus, state.snapshot ?? undefined);
  useEffect(() => {
    const unmount = binding.mount(), unsubscribe = subscribeSessionWitness(() => { if (!binding.current()) { controller.invalidate(); sheet.close(); } });
    const lifecycle = AppState.addEventListener('change', value => controller.setForeground(visible.current && value === 'active'));
    if (!binding.current()) controller.invalidate();
    return () => { lifecycle.remove(); unsubscribe(); unmount(); sheet.close(); };
  }, [binding, controller, sheet]);
  useFocusEffect(useCallback(() => {
    visible.current = true; controller.setForeground(AppState.currentState == null || AppState.currentState === 'active');
    return () => { visible.current = false; controller.setForeground(false); };
  }, [controller]));
  const rows = controller.rows();
  const openDetail = (order: MaterialSequenceOrder) => {
    if (!controller.current() || !controller.rows().includes(order)) return;
    const map = order.map;
    const row: SupplyTaskRow = { id: map.id, code: map.code, order_number: map.order_number, title: map.title,
      product_code: map.product_code, customer_name: map.customer_name, image_id: map.image_id, position: rows.indexOf(order),
      apparatus_count: 0, task_state: 'missing', products: map.products, combo: map.combo };
    void detail(row, () => controller.current() && controller.rows().includes(order));
  };
  const assignOrder = (order: MaterialSequenceOrder) => {
    if (sheet.isOpen() || !controller.current() || !controller.rows().includes(order)) return;
    sheet.open(createElement(MaterialSequenceAssignment, { session, witness, order,
      initialApparatus: state.selectedApparatus?.id ?? '', apparatusCatalog: state.apparatus,
      isCurrent: () => controller.current(), onClose: sheet.close }), { dismissible: true, heightFraction: 0.9 });
  };
  const emptyMessage = productionText(!state.selectedApparatus ? 'worker.queue.empty.select_apparatus'
    : state.search.trim() ? 'production.search_empty' : 'worker.queue.empty.for_apparatus', locale,
    { apparatus: state.selectedApparatus?.name.trim() ?? '' });
  return { controller, state, rows, locale, openDetail, assignOrder,
    emptyMessage, positionFor: (order: MaterialSequenceOrder) => controller.rowsUnfiltered().indexOf(order) + 1,
    toneFor: (order: MaterialSequenceOrder) => materialSequenceTone(order, state.snapshot, state.selectedApparatus),
    t: (key: string, values?: Record<string, unknown>) => productionText(key, locale, values) };
}
