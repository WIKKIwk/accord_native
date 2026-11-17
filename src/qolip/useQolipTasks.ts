import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { adminSequenceApparatusStore } from '../shared/adminSequenceApparatusStore';
import { SupplyTasksController } from '../shared/supplyTasks/SupplyTasksController';
import { applySupplyTaskMessage } from '../shared/supplyTasks/supplyTaskModels';
import { qolipOrderProducts } from '../qolipOrderProductsApi';
import { qolipDataRevision } from '../shared/qolipDataRevision';
import { useQolipCatalogEditors } from './useQolipCatalogEditors';
import { useQolipRole } from './QolipRoleContext';
import { useQolipText } from './useQolipText';
import { subscribeQolipTasksLive } from './qolipTasksLive';
import { qolipTasksWarmStore } from './qolipTasksWarmStore';
function createController(role: ReturnType<typeof useQolipRole>) {
  let first = true;
  return new SupplyTasksController({ session: role.session, kind: 'qolip', isCurrent: role.isCurrent,
    initialApparatus: adminSequenceApparatusStore.cachedApparatusId ?? '',
    loadWindow: query => { const fresh = !first; first = false; return qolipTasksWarmStore.read(role.session, query, role.isCurrent, fresh); },
  });
}
export function useQolipTasks() {
  const role = useQolipRole(), { text } = useQolipText(), editor = useQolipCatalogEditors(), [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [focused, setFocused] = useState(false), [serial, setSerial] = useState(0), [refreshing, setRefreshing] = useState(false), opening = useRef(false);
  const disconnect = useRef<(() => void) | null>(null), history = useRef({ attempts: 0, budget: 1, queryRevision: -1 });
  const controller = useMemo(() => createController(role), [role]);
  const mountedControllers = useRef(new Set<SupplyTasksController>());
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => { let active = true; const owners = mountedControllers.current; owners.add(controller);
    const stop = role.boundary.subscribe(() => { if (!role.isCurrent()) controller.invalidate(); });
    void adminSequenceApparatusStore.loadSavedApparatusId().then(saved => { if (active && role.isCurrent()) void controller.activate(saved ?? ''); });
    return () => { active = false; stop(); owners.delete(controller); queueMicrotask(() => { if (!owners.has(controller)) controller.dispose(); }); };
  }, [controller, role]);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  useEffect(() => { const subscription = AppState.addEventListener('change', value => setForeground(value === 'active')); return () => subscription.remove(); }, []);
  const hasWindow = !!state.window, queryKey = JSON.stringify(state.query), failed = !!state.error;
  useEffect(() => {
    if (!focused || !foreground || !hasWindow || state.loading || refreshing || failed || !controller.canInteract()) return;
    const continuity = history.current;
    if (continuity.queryRevision !== controller.queryRevision()) { continuity.queryRevision = controller.queryRevision(); continuity.budget = 1; }
    let active = true, generation = 0, stop = () => {}, reconnect: ReturnType<typeof setTimeout> | null = null, firstMessage: ReturnType<typeof setTimeout> | null = null;
    const current = () => active && role.isCurrent() && controller.canInteract();
    const detach = () => { generation++; stop(); stop = () => {}; if (firstMessage) clearTimeout(firstMessage); firstMessage = null; };
    const schedule = (version: number) => { if (!current() || version !== generation || reconnect) return; detach();
      reconnect = setTimeout(() => { reconnect = null; connect(); }, Math.min(30000, 1000 * 2 ** Math.min(continuity.attempts++, 5))); };
    const failure = (error: unknown, version: number) => {
      if (!current() || version !== generation) return;
      const e = error as { statusCode?: number; code?: string };
      if ([401,403].includes(e.statusCode ?? 0) || ['unauthorized','forbidden'].includes(e.code ?? '')) { detach(); qolipTasksWarmStore.invalidate(role.session); controller.streamError(error, true); }
      else if (error instanceof TypeError || ['supply_tasks_resync','supply_tasks_invalid'].includes(e.code ?? '')) {
        detach(); if (continuity.budget-- > 0) void controller.refresh().then(connect); else controller.streamError(error);
      } else schedule(version);
    };
    const connect = () => {
      const snapshot = controller.getSnapshot(), baseline = snapshot.window; if (!current() || !baseline || snapshot.error || snapshot.loading) return;
      detach(); const version = generation;
      firstMessage = setTimeout(() => schedule(version), 10000);
      const subscription = subscribeQolipTasksLive(role.session, baseline, current, event => {
        if (!current() || version !== generation) return;
        try {
          const old = controller.getSnapshot().window; if (!old) return;
          const next = applySupplyTaskMessage(event, old);
          if (next.kind !== old.kind || next.limit !== old.limit || next.search !== old.search || (next.apparatus_id !== old.apparatus_id && event.type !== 'snapshot')) throw new TypeError('Task stream changed query');
          if (firstMessage) clearTimeout(firstMessage); firstMessage = null; continuity.attempts = 0;
          if (next.revision > old.revision || next.epoch !== old.epoch || next.scope !== old.scope) continuity.budget = 1;
          if (next !== old) { controller.adoptLive(next); qolipTasksWarmStore.remember(role.session, next); }
        } catch (error) { failure(error, version); }
      }, error => failure(error, version), () => schedule(version));
      if (version !== generation || !current()) subscription(); else stop = subscription;
    };
    const stopLive = () => { active = false; detach(); if (reconnect) clearTimeout(reconnect); };
    disconnect.current = stopLive; connect(); return () => { stopLive(); if (disconnect.current === stopLive) disconnect.current = null; };
  }, [controller, role, focused, foreground, hasWindow, state.loading, refreshing, failed, queryKey, serial]);
  const refresh = async () => { disconnect.current?.(); setRefreshing(true); try { await controller.refresh(); }
    finally { setRefreshing(false); setSerial(value => value + 1); } };
  const attach = async (id: string) => {
    if (opening.current || !role.isCurrent()) return; opening.current = true;
    try { const products = await qolipOrderProducts(role.session, [id], role.isCurrent); if (!role.isCurrent()) return;
      const product = products[id]; if (!product || !product.item_group.trim()) { role.notice(text('tasks.product_missing')); return; }
      if (!product.has_qolip_spec) await editor.openSpec({ initialProduct: product, lockProduct: true, closeAfterSave: false });
      if (role.isCurrent()) qolipDataRevision.notifyLocationsChanged();
    } catch { if (role.isCurrent()) role.notice(text('tasks.load_failed')); }
    finally { opening.current = false; }
  };
  return { state, controller, refresh, attach };
}
