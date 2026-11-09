import { SymbolView } from 'expo-symbols';
import { StyleSheet, Text, View } from 'react-native';
import { useBaseTheme } from '../components/useBaseTheme';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { orderCardAppearance, type OrderCardTone } from '../workerOrderAppearance';

type Props = { headline: string; supportingText: string; position: number; tone: OrderCardTone;
  first?: boolean; last?: boolean; onPress: () => void };
export function AdminWorkMapSequenceRow({ headline, supportingText, position, tone, first, last, onPress }: Props) {
  const { mode, colors } = useBaseTheme(), appearance = orderCardAppearance(tone, colors.surfaceContainerLowest, mode === 'dark');
  const secondary = appearance.secondary ?? colors.onSurfaceVariant ?? colors.onSurface;
  return <WorkerQueueCard backgroundColor={appearance.color ?? colors.surfaceContainerLowest} backgroundImage={appearance.gradient}
    first={first} last={last} onPress={onPress}>
    <View accessible={false} style={[styles.cover, { backgroundColor: colors.secondaryContainer }]}>
      <SymbolView name={{ android: 'calculate' }} size={22} tintColor={colors.onSecondaryContainer} importantForAccessibility="no" />
    </View>
    <View style={[styles.badge, { backgroundColor: colors.primaryContainer }]}><Text style={[styles.badgeText, { color: colors.onPrimaryContainer }]}>{position}</Text></View>
    <View style={styles.text}><Text numberOfLines={1} style={[styles.headline, { color: appearance.text ?? colors.onSurface }]}>{headline}</Text>
      {!!supportingText && <Text numberOfLines={1} style={[styles.supporting, { color: secondary }]}>{supportingText}</Text>}</View>
  </WorkerQueueCard>;
}
const styles = StyleSheet.create({ cover: { width: 68, minHeight: 48, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  badge: { width: 30, height: 30, borderRadius: 15, marginHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontWeight: '800' }, text: { flex: 1 }, headline: { fontSize: 16, fontWeight: '700' }, supporting: { fontSize: 14 } });
