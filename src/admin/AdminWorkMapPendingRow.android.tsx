import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useBaseTheme } from '../components/useBaseTheme';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';

type Props = { headline: string; supportingText: string; infoLabel: string; first?: boolean; last?: boolean; onPress: () => void };
export function AdminWorkMapPendingRow({ headline, supportingText, infoLabel, first, last, onPress }: Props) {
  const { mode, colors } = useBaseTheme(), secondary = colors.onSurfaceVariant ?? colors.onSurface;
  return <WorkerQueueCard backgroundColor={mode === 'dark' ? '#3D2859' : '#EDE0FF'} first={first} last={last} onPress={onPress}>
    <View accessible={false} style={[styles.cover, { backgroundColor: colors.secondaryContainer }]}>
      <SymbolView name={{ android: 'calculate' }} size={22} tintColor={colors.onSecondaryContainer} importantForAccessibility="no" />
    </View>
    <View style={styles.text}><Text numberOfLines={1} style={[styles.headline, { color: colors.onSurface }]}>{headline}</Text>
      <Text numberOfLines={1} style={[styles.supporting, { color: secondary }]}>{supportingText}</Text></View>
    <Pressable accessibilityRole="button" accessibilityLabel={infoLabel} onPress={event => { event.stopPropagation(); onPress(); }} hitSlop={8} style={styles.info}>
      <SymbolView name={{ android: 'info_outline' }} size={22} tintColor={secondary} importantForAccessibility="no" />
    </Pressable>
  </WorkerQueueCard>;
}
const styles = StyleSheet.create({ cover: { width: 68, minHeight: 48, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, marginStart: 12 }, headline: { fontSize: 16, fontWeight: '700' }, supporting: { fontSize: 14 },
  info: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' } });
