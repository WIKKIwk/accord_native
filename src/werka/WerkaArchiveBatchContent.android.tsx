import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { werkaArchiveBatchPresentation, type WerkaArchiveBatchContentProps } from './werkaArchiveBatchPresentation';

/** Read-only panel; picker, send, routes and guarded state are intentionally not connected. */
export function WerkaArchiveBatchContent(props: WerkaArchiveBatchContentProps) {
  const view = werkaArchiveBatchPresentation(props), colors = useMaterialColors();
  return <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 112 }}>
    <WorkerQueueCard first last backgroundColor={colors.surfaceContainerLow}><View style={{ flex: 1, paddingHorizontal: 6, paddingVertical: 8, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}><View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: '800' }}>{view.title}</Text>
        <Text style={{ color: colors.onSurfaceVariant }}>{view.subtitle}</Text>
      </View>{props.state === 'loading' ? <ActivityIndicator color={colors.primary} />
        : <SymbolView name={{ android: props.state === 'missing' ? 'error_outline' : 'check_circle' }} size={20}
          tintColor={props.state === 'missing' ? colors.error : colors.primary} />}</View>
      <View testID="archive_batch_metrics" style={{ flexDirection: 'row', gap: 8 }}>
        {view.metrics.map(metric => <View key={metric.label} style={{ flex: 1, backgroundColor: colors.surfaceContainerHighest,
          borderColor: colors.outlineVariant, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, gap: 3 }}>
          <Text style={{ color: colors.onSurfaceVariant, fontSize: 12 }}>{metric.label}</Text>
          <Text numberOfLines={1} style={{ color: colors.onSurface, fontSize: 16, fontWeight: '600' }}>{metric.value}</Text>
        </View>)}
      </View>
      <View style={{ gap: 7 }}>{view.infoRows.map((row, index) => <View key={`${row.label}:${index}`} style={{ flexDirection: 'row', gap: 10 }}>
        <Text style={{ width: 96, color: colors.onSurfaceVariant }}>{row.label}</Text>
        <Text style={{ flex: 1, color: colors.onSurface, fontWeight: '700' }}>{row.value}</Text>
      </View>)}</View>
    </View></WorkerQueueCard>
  </ScrollView>;
}
