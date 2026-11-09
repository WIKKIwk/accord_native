import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useBaseTheme } from '../components/useBaseTheme';
import type { AdminWorkMapMovePane } from './adminWorkMapMoveTypes';

/** Source picker header, using the existing pane's read-only selection callback. */
export function AdminWorkMapMoveHeader({ pane }: { pane: AdminWorkMapMovePane }) {
  const { colors, direction } = useBaseTheme();
  return <Pressable testID={`admin-move-${pane.id}-picker`} accessibilityRole="button" accessibilityLabel={pane.name} onPress={pane.onPick}
    style={[styles.header, { backgroundColor: colors.primaryContainer, direction: direction === 'rightToLeft' ? 'rtl' : 'ltr' }]}>
    <SymbolView name={{ ios: 'gearshape.2', android: 'precision_manufacturing' }} size={16} tintColor={colors.onPrimaryContainer}
      accessibilityElementsHidden importantForAccessibility="no" />
    <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.title, { color: colors.onPrimaryContainer }]}>{pane.name}</Text>
    <SymbolView name={{ ios: 'chevron.down', android: 'expand_more' }} size={18} tintColor={colors.onPrimaryContainer}
      accessibilityElementsHidden importantForAccessibility="no" />
  </Pressable>;
}
const styles = StyleSheet.create({ header: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%' },
  title: { fontSize: 14, fontWeight: '800', flexShrink: 1 } });
