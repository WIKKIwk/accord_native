import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

export function WorkerOrderPauseStatus({ message, style }: { message: string; style: StyleProp<TextStyle> }) {
  const colors = useMaterialColors({});
  return <Text style={[style, styles.status, { color: colors.primary }]}>{message}</Text>;
}

const styles = StyleSheet.create({
  status: { alignSelf: 'stretch', textAlign: 'center', fontSize: 17, lineHeight: 24, fontWeight: '600', paddingVertical: 12 },
});
