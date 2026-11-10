import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { activeSessionToken, subscribeSessionWitness, type Session } from '../auth';
import type { AdminApparatus } from '../apparatusApi';
import { sessionReadScope } from '../sessionReadScope';
import { batchesForDay, dailyWorkApparatusNames, dailyWorkTotals, groupDailyWork, loadDailyWork, loadDailyWorkCatalog, parseDailyWorkHistory, type DailyWorkBatch } from '../dailyWork';

export function useDailyWork(session: Session) {
  const [day, setDay] = useState(() => new Date());
  const [batches, setBatches] = useState<DailyWorkBatch[] | null>(null);
  const [catalog, setCatalog] = useState<AdminApparatus[]>([]);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const request = useRef<AbortController | null>(null);
  const scope = useMemo(() => sessionReadScope(session), [session]);
  const retired = useMemo(() => ({ session, current: false }), [session]);
  const current = useCallback(() => !retired.current && !!activeSessionToken(session) && sessionReadScope(session) === scope, [session, scope, retired]);
  useEffect(() => subscribeSessionWitness(() => {
    if (!current()) { retired.current = true; request.current?.abort(); setBatches(null); setCatalog([]); }
  }), [current, retired]);

  const fetchHistory = useCallback(async (controller: AbortController) => {
    try {
      const result = await loadDailyWork(session, controller.signal);
      if (request.current !== controller || controller.signal.aborted || !current()) return;
      setBatches(result);
      setError('');
    } catch (reason) {
      if (request.current !== controller || controller.signal.aborted || !current()) return;
      setError(reason instanceof Error ? reason.message : 'Kunlik ish ma’lumotini yuklab bo‘lmadi.');
    } finally {
      if (request.current === controller) { request.current = null; setRefreshing(false); }
    }
  }, [session, current]);

  const refresh = useCallback(async () => {
    if (!current()) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setRefreshing(true);
    setError('');
    await fetchHistory(controller);
  }, [fetchHistory, current]);

  useEffect(() => {
    const historyController = new AbortController();
    const apparatusController = new AbortController();
    request.current = historyController;
    void loadDailyWork(session, historyController.signal).then(result => {
      if (request.current !== historyController || historyController.signal.aborted || !current()) return;
      setBatches(result);
      setError('');
    }, reason => {
      if (request.current !== historyController || historyController.signal.aborted || !current()) return;
      setError(reason instanceof Error ? reason.message : 'Kunlik ish ma’lumotini yuklab bo‘lmadi.');
    }).finally(() => { if (request.current === historyController) request.current = null; });
    void loadDailyWorkCatalog(session, apparatusController.signal).then(rows => {
      if (!apparatusController.signal.aborted && current()) setCatalog(rows);
    }).catch(() => {});
    return () => { apparatusController.abort(); request.current?.abort(); request.current = null; };
  }, [session, fetchHistory, current]);

  const replaceBatch = useCallback((source: Record<string, unknown>) => {
    if (!current()) return;
    const [batch] = parseDailyWorkHistory({ batches: [source] });
    if (!batch) return;
    // A read started before the correction must not overwrite its acknowledged revision.
    request.current?.abort(); request.current = null; setRefreshing(false);
    setBatches(rows => rows?.map(row => row.id === batch.id ? batch : row) ?? null);
  }, [current]);
  const apparatusNames = useMemo(() => dailyWorkApparatusNames(catalog), [catalog]);

  const visible = useMemo(() => batchesForDay(batches ?? [], day), [batches, day]);
  const groups = useMemo(() => groupDailyWork(visible), [visible]);
  const totals = useMemo(() => dailyWorkTotals(visible), [visible]);
  return { day, setDay, batches, catalog, apparatusNames, groups, totals, error, refreshing, refresh, replaceBatch, current };
}
