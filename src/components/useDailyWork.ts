import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { activeSessionToken, type Session } from '../auth';
import { batchesForDay, dailyWorkTotals, groupDailyWork, loadDailyWork, loadDailyWorkApparatus, type DailyWorkBatch } from '../dailyWork';

export function useDailyWork(session: Session) {
  const [day, setDay] = useState(() => new Date());
  const [batches, setBatches] = useState<DailyWorkBatch[] | null>(null);
  const [apparatusNames, setApparatusNames] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const request = useRef<AbortController | null>(null);

  const fetchHistory = useCallback(async (controller: AbortController) => {
    try {
      const result = await loadDailyWork(session, controller.signal);
      if (request.current !== controller || controller.signal.aborted || !activeSessionToken(session)) return;
      setBatches(result);
      setError('');
    } catch (reason) {
      if (request.current !== controller || controller.signal.aborted || !activeSessionToken(session)) return;
      setError(reason instanceof Error ? reason.message : 'Kunlik ish ma’lumotini yuklab bo‘lmadi.');
    } finally {
      if (request.current === controller) { request.current = null; setRefreshing(false); }
    }
  }, [session]);

  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setRefreshing(true);
    setError('');
    await fetchHistory(controller);
  }, [fetchHistory]);

  useEffect(() => {
    const historyController = new AbortController();
    const apparatusController = new AbortController();
    request.current = historyController;
    void loadDailyWork(session, historyController.signal).then(result => {
      if (request.current !== historyController || historyController.signal.aborted || !activeSessionToken(session)) return;
      setBatches(result);
      setError('');
    }, reason => {
      if (request.current !== historyController || historyController.signal.aborted || !activeSessionToken(session)) return;
      setError(reason instanceof Error ? reason.message : 'Kunlik ish ma’lumotini yuklab bo‘lmadi.');
    }).finally(() => { if (request.current === historyController) request.current = null; });
    void loadDailyWorkApparatus(session, apparatusController.signal).then(names => {
      if (!apparatusController.signal.aborted && activeSessionToken(session)) setApparatusNames(names);
    }).catch(() => {});
    return () => { apparatusController.abort(); request.current?.abort(); request.current = null; };
  }, [session, fetchHistory]);

  const visible = useMemo(() => batchesForDay(batches ?? [], day), [batches, day]);
  const groups = useMemo(() => groupDailyWork(visible), [visible]);
  const totals = useMemo(() => dailyWorkTotals(visible), [visible]);
  return { day, setDay, batches, apparatusNames, groups, totals, error, refreshing, refresh };
}
