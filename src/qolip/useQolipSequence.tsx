import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { adminApparatus, apparatusToJson, type AdminApparatus } from '../apparatusApi';
import { adminProductionMapQueueSnapshot } from '../productionMapQueueSnapshotApi';
import { queueFromSnapshot, workerApparatusCatalog } from '../workerApi';
import { subscribeWorkerLive } from '../workerLive';
import { adminSequenceApparatusStore } from '../shared/adminSequenceApparatusStore';
import type { productionMapSavedFromJson } from '../workerProductionMapSaved';
import { useQolipRole } from './QolipRoleContext';
import { QolipSequenceMoldsSheet } from './QolipSequenceMoldsSheet';
import { QolipSequenceOrderDetail } from './QolipSequenceOrderDetail';
import { useQolipPresentation } from './useQolipPresentation';
type Snapshot = Record<string, any>;
type Saved = ReturnType<typeof productionMapSavedFromJson>;
export function useQolipSequence() {
  const role = useQolipRole(), sheet = useQolipPresentation(), [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [apparatus, setApparatus] = useState<AdminApparatus[]>([]), [selected, setSelected] = useState(''), [query, setQuery] = useState(''),
    [loading, setLoading] = useState(true), [error, setError] = useState<unknown>(null);
  const latest = useRef(snapshot), generation = useRef(0), mounted = useRef(true);
  const current = useCallback(() => mounted.current && role.isCurrent(), [role]);
  const reload = useCallback(async (fresh = true) => {
    if (!current()) return; const version = ++generation.current; setError(null);
    const guard = () => { if (!current() || version !== generation.current) throw new Error('Hisob o‘zgardi.'); };
    try {
      const [data, catalog, saved] = await Promise.all([adminProductionMapQueueSnapshot(role.session, { fresh, current }),
        adminApparatus(role.session, { limit: 200, beforeSend: guard }), adminSequenceApparatusStore.loadSavedApparatusId()]);
      guard(); latest.current = data; setSnapshot(data); setApparatus(catalog);
      setSelected(previous => catalog.some(item => item.id === previous) ? previous : adminSequenceApparatusStore.resolveApparatus(catalog, saved)?.id ?? catalog[0]?.id ?? '');
    } catch (reason) { if (current() && version === generation.current) setError(reason); }
    finally { if (current() && version === generation.current) setLoading(false); }
  }, [current, role]);
  useEffect(() => { mounted.current = true; void Promise.resolve().then(() => { if (mounted.current) return reload(false); }); const lifecycle = generation; const stop = role.boundary.subscribe(() => {
    if (!role.isCurrent()) { generation.current++; latest.current = null; setSnapshot(null); setApparatus([]); }
  }); return () => { mounted.current = false; lifecycle.current++; stop(); }; }, [reload, role]);
  const ready = !!snapshot;
  useFocusEffect(useCallback(() => {
    if (!ready || !current()) return;
    return subscribeWorkerLive(role.session, '', () => { void reload(false); }, undefined, () => latest.current,
      next => { if (current()) { latest.current = next; setSnapshot(next); setError(null); } }, undefined,
      { isCurrent: current, workerScope: false, omitQueueLimit: true, deterministicReconnect: true, onError: reason => { if (current()) setError(reason); } });
  }, [ready, current, role.session, reload]));
  const machines = useMemo(() => workerApparatusCatalog(apparatus.map(apparatusToJson)), [apparatus]);
  const queue = useMemo(() => snapshot ? queueFromSnapshot(machines, snapshot, machines.map(machine => machine.id)) : null, [machines, snapshot]);
  const orders = (id: string) => {
    const q = query.trim().toLowerCase(), rows = queue?.orders[id] ?? [], maps = new Map<string, Saved>((snapshot?.maps ?? []).map((order: Saved) => [order.map.id, order]));
    return rows.filter(row => { if (!q) return true; const map = maps.get(row.id)?.map;
      return [row.code, map?.code, map?.order_number, row.title, map?.product_code, row.customer, ...(map?.nodes ?? []).map((node: any) => node.title)].join(' ').toLowerCase().includes(q);
    });
  };
  const select = (id: string) => { if (!current()) return; const machine = apparatus.find(item => item.id === id); if (!machine) return;
    setSelected(id); void adminSequenceApparatusStore.saveApparatus(machine); };
  const detail = (id: string) => { if (current() && !sheet.isOpen()) sheet.open(<QolipSequenceOrderDetail orderId={id} initialOrder={(latest.current?.maps as Saved[] | undefined)?.find(item => item.map.id === id)} apparatusCatalog={machines} onClose={sheet.close} />, { dismissible: false, fitContent: false }); };
  const molds = (id: string) => { if (!current() || sheet.isOpen()) return; const order = (latest.current?.maps as Saved[] | undefined)?.find(item => item.map.id === id);
    if (order) sheet.open(<QolipSequenceMoldsSheet order={order} />, { dismissible: true, fitContent: true }); };
  return { apparatus, selected, select, query, setQuery, loading, error, reload, orders, detail, molds, role };
}
