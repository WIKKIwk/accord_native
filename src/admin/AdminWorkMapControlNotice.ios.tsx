import { PlatformColor, StyleSheet, Text, View } from 'react-native';

export function AdminWorkMapControlNotice({ text }: { text: string }) {
  return <View testID="admin-order-control-notice" style={[styles.notice, { backgroundColor: PlatformColor('secondarySystemBackground') }]}>
    <Text style={[styles.text, { color: PlatformColor('systemRed') }]}>{text}</Text>
  </View>;
}
const styles = StyleSheet.create({ notice: { padding: 12, borderRadius: 12 }, text: { fontWeight: '700' } });
