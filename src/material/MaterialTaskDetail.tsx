import { useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { sessionWitnessVersion, subscribeSessionWitness } from '../auth';
import { WorkerExpansion } from '../components/WorkerExpansion';
import { WorkerMaterialList } from '../components/WorkerMaterialList';
import { WorkerOrderHeader, WorkerOrderImage } from '../components/WorkerOrderHeader';
import { WorkerOrderOverview } from '../components/WorkerOrderOverview';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { useWorkerColors } from '../components/useWorkerColors';
import { CustomerSnackbar } from '../customer/CustomerSnackbar';
import { useMaterialTaskDetailContent, type MaterialTaskDetailProps } from './useMaterialTaskDetailContent';

/** @v2 _ReadOnlyOrderDetailContent: the Material role's non-worker detail. */
export function MaterialTaskDetail(props: MaterialTaskDetailProps) {
  useSyncExternalStore(subscribeSessionWitness, sessionWitnessVersion, sessionWitnessVersion);
  const model = useMaterialTaskDetailContent(props), colors = useWorkerColors(), [imageOpen, setImageOpen] = useState(false);
  if (!model.current()) return null;
  if (imageOpen) return <WorkerOrderImage session={props.session} orderId={props.row.id} imageId={model.imageId} onClose={() => setImageOpen(false)} />;
  const materialsExpandable = model.materials.loading || !!model.materials.error || !!model.materials.value.length;
  const moldsExpandable = model.molds.loading || !!model.molds.error || !!model.molds.value.length;
  const card = { padding: 14, borderRadius: 18, backgroundColor: colors.surface, gap: 10 } as const;
  return <View style={{ flex: 1, backgroundColor: colors.field }}>
    <ScrollView nestedScrollEnabled contentContainerStyle={{ padding: 4, paddingTop: 12, paddingBottom: 24, gap: 4 }}>
      <WorkerOrderHeader session={props.session} orderId={props.row.id} imageId={model.imageId} code={model.code}
        title={[model.customer, model.title].filter(Boolean).join(' • ')} onOpenImage={() => setImageOpen(true)} onClose={props.onClose} />
      {!model.shown && <ActivityIndicator color={colors.icon} />}
      {model.shown?.error != null && <View style={card}><Text style={{ color: colors.error }}>{model.shown.error}</Text>
        <WorkerSheetButton label={model.p('worker.action.retry')} variant="text" onPress={model.retry} /></View>}
      {model.order && <>
        <View style={card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><View style={{ flex: 1 }}>
            <WorkerExpansion title={model.p(materialsExpandable ? 'worker.materials.attached' : 'worker.materials.attached.empty')}
              count={model.materials.loading ? '..' : model.materials.value.length ? String(model.materials.value.length) : ''}
              expanded={materialsExpandable && model.materialsExpanded} onPress={materialsExpandable ? model.toggleMaterials : undefined} />
          </View>{!materialsExpandable && model.canReceive && <View style={{ width: 106 }}>
            <WorkerSheetButton label={model.a('action.assign')} variant="text" onPress={model.receive} height={48} />
          </View>}</View>
          {materialsExpandable && model.materialsExpanded && <>
            {model.materials.loading && <ActivityIndicator color={colors.icon} />}
            {!!model.materials.error && <Text style={{ color: colors.error }}>{model.materials.error}</Text>}
            {!model.materials.loading && !model.materials.error && <WorkerMaterialList rows={model.materials.value} scanned={[]} orderId={props.row.id}
              onLongPress={row => model.openMaterialQr(row as typeof model.materials.value[number])}
              onUnlink={row => model.unlink(row as typeof model.materials.value[number])}
              canUnlink={row => model.canUnlink(row as typeof model.materials.value[number])} unlinkingBarcode={model.unlinking} />}
          </>}
          <WorkerExpansion title={model.p(moldsExpandable ? 'worker.molds.attached' : 'worker.molds.attached.empty')}
            count={model.molds.loading ? '..' : model.molds.value.length ? String(model.molds.value.length) : ''}
            expanded={moldsExpandable && model.moldsExpanded} onPress={moldsExpandable ? model.toggleMolds : undefined} />
          {moldsExpandable && model.moldsExpanded && <>
            {model.molds.loading && <ActivityIndicator color={colors.icon} />}
            {!!model.molds.error && <Text style={{ color: colors.error }}>{model.molds.error}</Text>}
            {model.moldItems.map(({ product: mold, color, details }) => <Pressable key={mold.qolip_code} onLongPress={() => model.openMoldQr(mold)}
              style={{ padding: 12, borderRadius: 12, backgroundColor: colors.field, gap: 4 }}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{model.p('worker.mold.code', { code: mold.qolip_code.trim() })}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {color && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color }} />}
                <Text style={{ color: colors.muted }}>{details}</Text>
              </View>
            </Pressable>)}
          </>}
        </View>
        <WorkerOrderOverview session={props.session} orderId={props.row.id} code={model.code} title={model.title} imageId={model.imageId} summaryKind="information"
          detail={{ map: model.order.map, customer: model.customer, stages: [] }} />
        <View style={card}>
          <WorkerExpansion title={model.p('worker.action.view_map')} count="" expanded={model.mapExpanded} onPress={model.toggleMap} />
          <Text style={{ color: colors.muted }}>{model.mapProgress}</Text>
          {model.mapExpanded && <>
            {model.mapFacts.loading && <ActivityIndicator color={colors.icon} />}
            {!!model.mapFacts.error && <><Text style={{ color: colors.error }}>{model.mapFacts.error}</Text>
              <WorkerSheetButton label={model.p('worker.action.retry')} variant="text" onPress={model.retryMap} /></>}
            {!model.mapFacts.error && model.mapRows.map((stage, index) => <Pressable key={`${stage.node.id}:${index}`}
              onPress={stage.apparatus ? () => model.openStage(stage.apparatus, stage.title) : undefined}
              style={{ padding: 12, borderRadius: 12, backgroundColor: colors.field, gap: 4 }}>
              <Text style={{ color: colors.text }}>{index + 1}. {stage.title}</Text>
              {stage.apparatus && <Text style={{ color: colors.muted }}>{model.a(stage.status === 'completed' ? 'factory_map.filter.completed' : `factory_map.live.${stage.status}`)}</Text>}
              {stage.facts.produced > 0 && <Text style={{ color: colors.muted }}>{model.a('factory_map.wip.produced', { count: stage.facts.produced })}</Text>}
              {stage.facts.waitingInput + stage.facts.inUseInput + stage.facts.processedInput > 0 && <Text style={{ color: colors.muted }}>
                {model.a('factory_map.wip.input', { waiting: stage.facts.waitingInput, inUse: stage.facts.inUseInput, processed: stage.facts.processedInput })}</Text>}
            </Pressable>)}
          </>}
        </View>
      </>}
    </ScrollView>
    <CustomerSnackbar message={model.notice} messageId={model.notice ? model.noticeId : null} onDismiss={model.dismissNotice} />
  </View>;
}
