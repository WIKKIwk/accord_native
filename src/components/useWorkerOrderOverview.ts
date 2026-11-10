import { createElement, useState, useSyncExternalStore } from 'react';
import type { Session } from '../auth';
import { useNativeSheet } from '../nativeSheet';
import { productionText } from '../shared/localization';
import { workerOrderText } from '../workerOrderText';
import { localeController } from '../shared/localization/runtime';
import type { WorkerOrderDetail } from '../workerApi';
import { WorkerWipHistory } from './WorkerWipHistory';

export type WorkerOrderOverviewProps = {
  session: Session; orderId: string; code: string; title: string; imageId: string; detail: WorkerOrderDetail | null;
};
const stageStates: Record<string, string> = {
  pending: 'Kutilmoqda', waiting: 'Kutilmoqda', in_progress: 'Ish jarayonida', paused: 'Pauzada',
  completed: 'Tugallangan', frozen: 'Muzlatilgan', print_preflight: 'Rang chiqarilyapti',
  print_preflight_passed: 'Rang chiqdi', waiting_next_stage: 'Keyingi bosqich kutilmoqda',
};
const positive = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
const subscribe = (listener: () => void) => localeController.addListener(listener);
const snapshot = () => localeController.locale;

export function useWorkerOrderOverview({ session, orderId, code, title, imageId, detail }: WorkerOrderOverviewProps) {
  const [expanded, setExpanded] = useState(false), history = useNativeSheet();
  const locale = useSyncExternalStore(subscribe, snapshot, snapshot);
  const text = (key: string, values?: Record<string, unknown>) => productionText(key, locale, values);
  const meters = positive(detail?.map.base_length), kg = positive(detail?.map.order_kg);
  const shafts = positive(detail?.map.roll_count), width = positive(detail?.map.width_mm);
  const metrics: { id: string; label: string; value: string; unit: string }[] = [];
  if (meters !== null) metrics.push({ id: 'length', label: text('worker.summary.length'), value: String(Math.ceil(meters / 500) * 500), unit: 'm' });
  if (kg !== null) metrics.push({ id: 'weight', label: text('worker.summary.weight'), value: String(kg), unit: 'kg' });
  const facts = [];
  if (shafts !== null) facts.push({ id: 'shafts', label: text('worker.summary.shafts'),
    value: text('worker.summary.shaft_value', { count: shafts, width: width ?? '—' }) });
  if (detail) facts.push({ id: 'print-side', label: text('order.print_side'),
    value: text(detail.map.standard_print_side === false ? 'order.print_side.nonstandard' : 'order.print_side.standard') });

  return {
    expanded, enabled: !!detail, toggle: () => { if (detail) setExpanded(value => !value); }, metrics, facts,
    title: text('worker.summary.expected.result_title'), subtitle: text('worker.summary.expected.subtitle'),
    stagesTitle: text('worker.qr.report.stages'),
    stages: detail?.stages.map((stage, index) => ({ ...stage, number: index + 1, stateLabel: workerOrderText(stageStates[stage.state] ?? '', locale) })) ?? [],
    openStage(apparatusId: string) {
      if (!apparatusId) return;
      const apparatusNames = Object.fromEntries(detail?.stages.filter(stage => stage.apparatusId).map(stage => [stage.apparatusId, stage.title]) ?? []);
      history.open(createElement(WorkerWipHistory, { session, order: { id: orderId, code, title, imageId, apparatusId },
        apparatusNames, stageHistory: true, onClose: history.close }), { dismissible: true });
    },
  };
}
