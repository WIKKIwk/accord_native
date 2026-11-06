import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWorkerColors } from '../components/useWorkerColors';

export function PreparationNotice({ message }: { message: string }) {
  const colors = useWorkerColors(), insets = useSafeAreaInsets();
  if (!message) return null;
  return <View pointerEvents="none" accessibilityRole="alert" accessibilityLiveRegion="polite"
    style={[styles.notice, { bottom: insets.bottom + 78, backgroundColor: colors.text }]}>
    <Text style={{ color: colors.surface }}>{message}</Text>
  </View>;
}

const styles = StyleSheet.create({
  notice: { position: 'absolute', left: 16, right: 16, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 14 },
});
