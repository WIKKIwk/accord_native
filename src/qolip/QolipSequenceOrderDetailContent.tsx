import { ActivityIndicator, Platform, PlatformColor, ScrollView, Text, View } from 'react-native';
import { WorkerMaterialList } from '../components/WorkerMaterialList';
import { WorkerOrderHeader } from '../components/WorkerOrderHeader';
import { WorkerOrderOverview } from '../components/WorkerOrderOverview';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { useWorkerColors } from '../components/useWorkerColors';
import { QolipOrderMoldRow, QolipOrderSection, QolipOrderStageRow } from './QolipOrderDetailNative';
import type { QolipSequenceOrderDetailModel } from './useQolipSequenceOrderDetail';
export function QolipSequenceOrderDetailContent({ state: h }: { state: QolipSequenceOrderDetailModel }) {
  const colors = useWorkerColors();
  if (!h.valid) return null;
  return <View style={{ flex: 1, backgroundColor: Platform.OS === 'ios' ? PlatformColor('systemGroupedBackground') : colors.field }}>
    <WorkerOrderHeader session={h.role.session} orderId={h.order?.map.id ?? ''} imageId={h.imageId} code={h.code || '-'} codeLabel={h.p('worker.order.code')} title={h.title} onClose={h.close} onOpenImage={h.image} />
    <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 24, gap: 10 }}>
      {!!h.errorMessage && <View style={{ padding: 12, gap: 10 }}><Text accessibilityRole="alert" style={{ color: colors.error }}>{h.errorMessage}</Text><WorkerSheetButton label={h.p('worker.action.retry')} height={50} onPress={() => { void h.controller.load(); }} /></View>}
      {h.pending && <ActivityIndicator style={{ height: 48 }} />}
      <QolipOrderSection title={h.materialsTitle} count={h.materialsCount} expanded={h.materialsExpanded && h.materialsEnabled} enabled={h.materialsEnabled} onPress={h.controller.toggleMaterials}>
        {h.materialsLoading ? <ActivityIndicator /> : h.materialsMessage ? <Text style={{ color: h.materialsError ? colors.error : colors.muted }}>{h.materialsMessage}</Text>
          : <WorkerMaterialList rows={h.materials} orderId={h.order?.map.id} scanned={[]} onLongPress={h.material} />}
      </QolipOrderSection>
      <QolipOrderSection title={h.moldsTitle} count={h.moldsCount} expanded={h.moldsExpanded} enabled={h.moldsEnabled} onPress={h.controller.toggleMolds}>
        {h.moldsLoading ? <ActivityIndicator /> : h.moldsMessage ? <Text style={{ color: h.moldsError ? colors.error : colors.muted }}>{h.moldsMessage}</Text>
          : h.moldRows.map(row => <QolipOrderMoldRow key={row.id} row={row} onLongPress={() => h.mold(row)} />)}
      </QolipOrderSection>
      <WorkerOrderOverview session={h.role.session} orderId={h.order?.map.id ?? ''} code={h.code} title={h.title} imageId={h.imageId} detail={h.pending ? null : h.overview} summaryTitle={h.p('worker.summary.expected.title')} />
      <QolipOrderSection title={h.p('worker.action.view_map')} subtitle={h.pending ? '\u00a0' : h.mapProgress} expanded={h.mapExpanded} enabled={!h.pending && !!h.order} onPress={h.controller.toggleMap}>
        {h.stageLoading && !h.stageLoaded ? <ActivityIndicator style={{ height: 48 }} /> : h.stageError ? <View style={{ gap: 12 }}><Text style={{ color: colors.error }}>{h.a('factory_map.wip.load_error')}</Text>
          <WorkerSheetButton label={h.p('worker.action.retry')} height={48} onPress={() => { void h.controller.loadStages(); }} /></View> : <>
          {h.stageLoading && <ActivityIndicator />}{h.stageRows.map(row => <QolipOrderStageRow key={row.id} row={row} onPress={() => h.stage(row)} />)}
        </>}
      </QolipOrderSection>
    </ScrollView>
  </View>;
}
