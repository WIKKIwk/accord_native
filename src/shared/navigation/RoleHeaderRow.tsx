import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useWorkerColors } from '../../components/useWorkerColors';
import { roleHeaderMetrics as metrics } from './roleNavigationMetrics';

export function RoleHeaderRow({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

export function RoleHeaderSearchField({ focused, children }: { focused: boolean; children: ReactNode }) {
  const colors = useWorkerColors();
  return <View style={[styles.field, focused && styles.focusedField, { backgroundColor: colors.field }]}>
    {!focused && <View pointerEvents="none" accessible={false} style={styles.searchIcon}>
      <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={24} tintColor={colors.icon} />
    </View>}
    {children}
  </View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: metrics.gap,
    minHeight: metrics.minHeight,
    paddingHorizontal: metrics.horizontalPadding,
    paddingVertical: metrics.verticalPadding,
  },
  field: { flex: 1, minWidth: 0, minHeight: 56, flexDirection: 'row', alignItems: 'center', borderRadius: 30, paddingHorizontal: 4 },
  focusedField: { paddingLeft: 16 },
  searchIcon: { width: 32, height: 44, alignItems: 'center', justifyContent: 'center' },
});
