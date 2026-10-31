import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useWorkerColors } from './useWorkerColors';

type Props = { title: string; count: string; expanded: boolean; onPress: () => void };

export function WorkerExpansion({ title, count, expanded, onPress }: Props) {
  const colors = useWorkerColors();
  return <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={onPress} style={styles.expansion}>
    <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
    {!!count && <Text style={[styles.muted, { color: colors.muted }]}>{count}</Text>}
    <SymbolView name={{ android: expanded ? 'expand_less' : 'expand_more', ios: expanded ? 'chevron.up' : 'chevron.down', web: expanded ? 'expand_less' : 'expand_more' }} size={20} tintColor={colors.icon} />
  </Pressable>;
}

const styles = StyleSheet.create({
  expansion: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40 },
  title: { flex: 1, fontSize: 16, fontWeight: '500' },
  muted: { fontSize: 14, color: '#52617a', lineHeight: 21 },
});
