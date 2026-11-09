import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useWorkerColors } from '../components/useWorkerColors';
import type { adminClosedLogDetail, ClosedLogField } from './adminClosedLogPresentation';

const icons = {
  history: { ios: 'clock.arrow.circlepath', android: 'history' }, freeze: { ios: 'lock', android: 'lock_clock' },
  transfer: { ios: 'arrow.left.arrow.right', android: 'swap_horiz' }, event: { ios: 'info.circle', android: 'info_outline' },
  progress: { ios: 'chart.bar', android: 'analytics' }, qr: { ios: 'qrcode', android: 'qr_code_2' },
} satisfies Record<string, SymbolViewProps['name']>;
type Model = ReturnType<typeof adminClosedLogDetail>;

/** Passive content only; the owning row and native sheet remain unconnected until the history boundary is reviewed. */
export function AdminClosedLogSheet({ model }: { model: Model }) {
  const colors = useWorkerColors();
  const field = (item: ClosedLogField, index: number) => <View key={`${item.label}:${index}`} style={styles.field}>
    <Text style={[styles.label, { color: colors.muted }]}>{item.label}</Text>
    <Text selectable={item.selectable} numberOfLines={item.selectable ? undefined : 8} style={[styles.value, { color: colors.text }]}>{item.value}</Text>
  </View>;
  return <ScrollView testID="admin-closed-log-sheet" contentContainerStyle={[styles.content, { backgroundColor: colors.background }]}>
    <View style={styles.header}><SymbolView name={icons[model.icon]} size={24} tintColor={colors.icon} accessibilityElementsHidden importantForAccessibility="no" />
      <View style={styles.headerText}><Text style={[styles.title, { color: colors.text }]}>{model.title}</Text>
        {!!model.apparatus && <Text style={{ color: colors.muted }}>{model.apparatus}</Text>}</View></View>
    {model.sections.map(section => <View key={section.id} style={[styles.section, { backgroundColor: colors.surface }]}>
      <View style={styles.heading}><SymbolView name={icons[section.id]} size={20} tintColor={colors.icon} accessibilityElementsHidden importantForAccessibility="no" />
        <Text style={[styles.headingText, { color: colors.text }]}>{section.title}</Text></View>
      {section.fields.map(field)}
      {section.metrics?.map((value, index) => <Text key={`${value}:${index}`} style={[styles.metric, { color: colors.text }]}>{value}</Text>)}
      {!!section.empty && <Text style={{ color: colors.muted }}>{section.empty}</Text>}
      {section.batches?.map((batch, index) => <View key={`${batch.title}:${index}`} style={[styles.batch, index > 0 && { borderTopColor: colors.muted, borderTopWidth: StyleSheet.hairlineWidth }]}>
        <Text style={[styles.batchTitle, { color: colors.text }]}>{batch.title}</Text>
        {!!batch.status && <Text style={{ color: colors.muted }}>{batch.status}</Text>}
        {batch.fields.map(field)}
        {batch.metrics.map((value, metricIndex) => <Text key={`${value}:${metricIndex}`} style={[styles.metric, { color: colors.text }]}>{value}</Text>)}
        {batch.note && field(batch.note, batch.fields.length)}
        {batch.qr && <View style={styles.qr}><SymbolView name={icons.qr} size={20} tintColor={colors.icon} accessibilityElementsHidden importantForAccessibility="no" />
          <View style={styles.headerText}><Text style={[styles.qrLabel, { color: colors.text }]}>{batch.qr.label}</Text>
            <Text selectable style={{ color: colors.text, fontFamily: 'monospace' }}>{batch.qr.payload}</Text></View></View>}
      </View>)}
    </View>)}
  </ScrollView>;
}
const styles = StyleSheet.create({ content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24, gap: 16 },
  header: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' }, headerText: { flex: 1, gap: 4 }, title: { fontSize: 22, fontWeight: '800' },
  section: { borderRadius: 18, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12 }, heading: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 10 },
  headingText: { fontSize: 16, fontWeight: '800' }, field: { flexDirection: 'row', paddingVertical: 4 }, label: { width: 116, fontSize: 12, fontWeight: '600' },
  value: { flex: 1, fontSize: 12 }, metric: { fontSize: 12, paddingVertical: 2 }, batch: { paddingTop: 12, gap: 4 }, batchTitle: { fontWeight: '800' },
  qr: { flexDirection: 'row', gap: 8, paddingTop: 8 }, qrLabel: { fontWeight: '800' } });
