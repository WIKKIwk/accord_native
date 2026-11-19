import { useBaseTheme } from '../components/useBaseTheme';
import { StyleSheet, Text, View } from 'react-native';

export function AdminWorkMapControlNotice({ text }: { text: string }) {
  const colors = useBaseTheme().colors;
  return <View testID="admin-order-control-notice" style={[styles.notice, { backgroundColor: colors.errorContainer }]}>
    <Text style={[styles.text, { color: colors.onErrorContainer }]}>{text}</Text>
  </View>;
}
const styles = StyleSheet.create({ notice: { padding: 12, borderRadius: 12 }, text: { fontWeight: '700' } });
