import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { activeSessionToken } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { productionDataRevision } from '../shared/productionDataRevisionRuntime';
import { adminWipBatches } from '../workerWipApi';
import { workerOrderPlannedMeters, workerOutputStage, workerStageOutputMeters, workerWipConsumerIds, type WorkerOutputProgressProps } from '../workerOutputProgress';
import { useWorkerOrderText } from './useWorkerOrderText';

type Output = { key: string; meters: number; known: number; missing: number; failed?: boolean };
export function useWorkerOutputProgress({ session, orderId, apparatusId, stageId, map, operation = 'print', outputRevision }: WorkerOutputProgressProps) {
  const { locale, t, p } = useWorkerOrderText();
  const [output, setOutput] = useState<Output | null>(null);
  const scope = sessionReadScope(session);
  const stage = useMemo(() => workerOutputStage(map, apparatusId, stageId), [map, apparatusId, stageId]);
  const producers = useMemo(() => workerWipConsumerIds(map, apparatusId, stage), [map, apparatusId, stage]);
  const key = JSON.stringify([scope, orderId, apparatusId, stage, producers]);
  const current = output?.key === key ? output : null;
  const plan = workerOrderPlannedMeters(map.base_length);
  const enabled = ['print', 'laminate'].includes(operation) && !!stage && !!producers.length;
  useFocusEffect(useCallback(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let loading = false, queued = false;
    const valid = () => !controller.signal.aborted && !!activeSessionToken(session) && sessionReadScope(session) === scope;
    const read = async () => {
      if (!valid() || (AppState.currentState && AppState.currentState !== 'active')) return;
      if (loading) { queued = true; return; }
      loading = true;
      try {
        const pages = await Promise.all(producers.map(producer => adminWipBatches(session, {
          status: 'all', orderId, producerApparatus: producer, limit: 500, signal: controller.signal,
        })));
        if (valid()) setOutput({ key, ...workerStageOutputMeters(map, orderId, stage, pages.flat()) });
      } catch { if (valid()) setOutput({ key, meters: 0, known: 0, missing: 0, failed: true }); }
      finally { loading = false; if (queued && valid()) { queued = false; void read(); } }
    };
    void read();
    const timer = setInterval(() => { if (!loading) void read(); }, 30_000);
    const app = AppState.addEventListener('change', state => { if (state === 'active') void read(); });
    const unsubscribe = productionDataRevision.subscribe(() => { if (productionDataRevision.isCurrentScope) void read(); });
    return () => { controller.abort(); clearInterval(timer); app.remove(); unsubscribe(); };
  // V2 didUpdateWidget revalidates on outputRevision while keeping the previous totals visible.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, scope, orderId, producers, key, stage, map, enabled, outputRevision]));
  const amount = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(value);
  const measured = !current || (!current.known && current.missing > 0) ? '—' : amount(current.meters);
  const ratio = current && !current.failed && !current.missing && plan !== null ? current.meters / plan : null;
  return { enabled, title: p(`worker.output_progress.${operation}`), ratio: ratio === null ? null : Math.max(0, Math.min(1, ratio)),
    percent: ratio === null ? '' : `${Math.floor(ratio * 100)}%`,
    measured: plan === null ? `${measured} m` : `${measured} / ${amount(plan)} m`,
    status: !current ? t('Yuklanmoqda…') : current.failed ? p('worker.output_progress.unavailable') : '',
    footnote: !current || current.failed ? '' : current.missing ? p('worker.output_progress.missing', { count: current.missing })
      : plan === null ? '' : p('worker.output_progress.remaining', { value: amount(Math.max(0, plan - current.meters)) }) };
}
