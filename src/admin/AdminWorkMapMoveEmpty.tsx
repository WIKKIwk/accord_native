import { StyleSheet, Text, View } from 'react-native';
import { useBaseTheme } from '../components/useBaseTheme';

export function AdminWorkMapMoveEmpty({ text }: { text: string }) {
  const { colors } = useBaseTheme();
  return <View style={styles.center}><Text style={[styles.text, { color: colors.onSurfaceVariant }]}>{text}</Text></View>;
}
const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, text: { textAlign: 'center' } });
