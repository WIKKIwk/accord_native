import { Column, Host, LinearProgressIndicator, Text } from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { AppState, StyleSheet } from 'react-native';
import { loadWorkerWipBatches, wipMeters, wipText, type WipBatch } from '../workerWip';
import type { WorkerOutputProgressProps } from './WorkerOutputProgress';

type MapNode = { id: string; kind: string; apparatus_id?: string; alternative_group_id?: string };
type Output = { key: string; meters: number; known: number; missing: number; failed?: boolean };

function outputTotals(batches: WipBatch[], stages: MapNode[], candidates: MapNode[]) {
  const latest = new Map<string, WipBatch>();
  for (const batch of batches) {
    const previous = latest.get(batch.batch_id);
    if (!previous || Number(batch.revision) > Number(previous.revision)) latest.set(batch.batch_id, batch);
  }
  let units = 0;
  let known = 0;
  let missing = 0;
  for (const batch of latest.values()) {
    if (['void', 'peremotka'].includes(batch.wip_status) || batch.payload_json?.origin === 'layer_remainder') continue;
    const output = (batch.action === 'pause' && ['paused', 'resumed'].includes(batch.status)) ||
      (batch.action === 'detach_roll' && ['roll_detached', 'resumed'].includes(batch.status)) ||
      (['roll_complete', 'complete'].includes(batch.action) && batch.status === 'completed');
    if (!output) continue;
    const sourceId = wipText(batch.payload_json?.stage_node_id);
    const source = sourceId ? stages.filter(node => node.id === sourceId) : stages.filter(node => node.apparatus_id === batch.apparatus);
    if (source.length !== 1 || !candidates.includes(source[0])) continue;
    const meters = wipMeters(batch);
    if (meters === null) missing++;
    else { units += Math.round(meters * 1000000); known++; }
  }
  return { meters: units / 1000000, known, missing };
}

export function WorkerOutputProgress({ session, orderId, apparatusId, stageId, map }: WorkerOutputProgressProps) {
  const [output, setOutput] = useState<Output | null>(null);
  const key = JSON.stringify([session.imageCacheScope, orderId, apparatusId, stageId]);
  const current = output?.key === key ? output : null;
  const plan = typeof map.base_length === 'number' && map.base_length > 0 ? Math.ceil(map.base_length / 500) * 500 : null;
  const stages = useMemo(() => (Array.isArray(map.nodes) ? map.nodes : [])
    .filter((node): node is MapNode => node?.kind === 'apparatus'), [map]);
  const matches = stages.filter(node => stageId ? node.id === stageId : node.apparatus_id === apparatusId);
  const stage = matches.length === 1 ? matches[0] : null;

  useFocusEffect(useCallback(() => {
    if (!stage) return;
    const candidates = stages.filter(node => node === stage || (!!stage.alternative_group_id && node.alternative_group_id === stage.alternative_group_id));
    const producers = [...new Set(candidates.map(node => wipText(node.apparatus_id)).filter(Boolean))];
    if (!producers.length) return;
    const controller = new AbortController();
    let loading = false;
    const read = async () => {
      if (loading || (AppState.currentState && AppState.currentState !== 'active')) return;
      loading = true;
      try {
        const results = await Promise.all(producers.map(producer => loadWorkerWipBatches(session, orderId, producer, controller.signal)));
        if (!controller.signal.aborted) setOutput({ key, ...outputTotals(results.flat(), stages, candidates) });
      } catch {
        if (!controller.signal.aborted) setOutput({ key, meters: 0, known: 0, missing: 0, failed: true });
      } finally { loading = false; }
    };
    void read();
    const timer = setInterval(() => { void read(); }, 30000);
    return () => { clearInterval(timer); controller.abort(); };
  }, [session, orderId, key, stage, stages]));

  if (!stage) return null;
  const measured = current?.missing && !current.known ? '—' : String(current?.meters ?? 0);
  return <Host matchContents={{ vertical: true }} style={styles.host}>
    <Column verticalArrangement={{ spacedBy: 4 }}>
      <Text>Bosma progressi</Text>
      {current && !current.failed && !current.missing && plan !== null && <LinearProgressIndicator
        progress={Math.min(1, current.meters / plan)} modifiers={[fillMaxWidth()]} />}
      {!current || current.failed ? <Text>{current?.failed ? 'Metraj progressini yuklab bo‘lmadi' : 'Yuklanmoqda…'}</Text> : <>
        <Text>{plan === null ? `${measured} m` : `${measured} / ${plan} m`}</Text>
        {current.missing > 0 ? <Text>{`${current.missing} ta rulonning metraji noma’lum`}</Text> :
          plan !== null && <Text>{`${Math.max(0, plan - current.meters)} m qoldi`}</Text>}
      </>}
    </Column>
  </Host>;
}

const styles = StyleSheet.create({ host: { width: '100%' } });
