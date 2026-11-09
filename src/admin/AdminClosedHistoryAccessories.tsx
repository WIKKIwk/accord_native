import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { StyleSheet, Text, View } from 'react-native';
import { useBaseTheme } from '../components/useBaseTheme';
import type { ClosedLogIcon } from './adminClosedLogPresentation';

const icons = {
  freeze: { ios: 'lock', android: 'lock_clock' }, transfer: { ios: 'arrow.left.arrow.right', android: 'swap_horiz' },
  start: { ios: 'play.fill', android: 'play_arrow' }, pause: { ios: 'pause.fill', android: 'pause' },
  detach_roll: { ios: 'archivebox', android: 'unarchive' }, merge: { ios: 'link', android: 'link' },
  resume: { ios: 'arrow.clockwise', android: 'replay' }, roll_complete: { ios: 'checkmark.circle', android: 'done_all' },
  complete: { ios: 'checkmark', android: 'check' }, close_early: { ios: 'stop.circle', android: 'stop_circle' },
  history: { ios: 'clock.arrow.circlepath', android: 'history' },
} satisfies Record<ClosedLogIcon, SymbolViewProps['name']>;
export function AdminClosedRank({ position }: { position: string }) {
  const { colors } = useBaseTheme();
  return <View style={[styles.rank, { backgroundColor: colors.primaryContainer }]}><Text style={[styles.rankText, { color: colors.onPrimaryContainer }]}>{position}</Text></View>;
}
export function AdminClosedLogIcon({ icon }: { icon: ClosedLogIcon }) {
  const { colors } = useBaseTheme();
  return <View accessible={false} style={[styles.icon, { backgroundColor: colors.secondaryContainer }]}>
    <SymbolView name={icons[icon]} size={18} tintColor={colors.onSecondaryContainer} accessibilityElementsHidden importantForAccessibility="no" />
  </View>;
}
const styles = StyleSheet.create({ rank: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontWeight: '800' }, icon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' } });
