import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { StyleSheet, Text, View } from 'react-native';
import { useBaseTheme } from '../components/useBaseTheme';
import type { AdminWorkMapAuditPresentation } from './adminWorkMapAuditPresentation';

const icons: Record<string, SymbolViewProps['name']> = {
  orders: { ios: 'doc.text' }, batches: { ios: 'shippingbox' }, sessions: { ios: 'play.circle' }, errors: { ios: 'exclamationmark.triangle' },
};

/** Passive count chips; their text and order come from the guarded audit report. */
export function AdminWorkMapAuditCounts({ counts }: { counts: AdminWorkMapAuditPresentation['counts'] }) {
  const { colors, direction } = useBaseTheme();
  return <View style={[styles.wrap, { direction: direction === 'rightToLeft' ? 'rtl' : 'ltr' }]}>
    {counts.map(count => <View key={count.id} accessible accessibilityLabel={count.text}
      style={[styles.chip, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}>
      <SymbolView name={icons[count.id]} size={17} tintColor={colors.onSurfaceVariant} accessibilityElementsHidden importantForAccessibility="no" />
      <Text style={{ color: colors.onSurfaceVariant }}>{count.text}</Text>
    </View>)}
  </View>;
}
const styles = StyleSheet.create({ wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 32, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5,
    flexDirection: 'row', alignItems: 'center', gap: 8 } });
