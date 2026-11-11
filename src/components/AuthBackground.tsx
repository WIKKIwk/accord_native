import { StyleSheet, View } from 'react-native';
import { useBaseTheme } from './useBaseTheme';

export function AuthBackground() {
  const { colors } = useBaseTheme();
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.background}>
    <View style={[styles.oval, { borderColor: colors.outlineVariant }]} />
    <View style={[styles.circle, { borderColor: colors.primary }]} />
  </View>;
}

const styles = StyleSheet.create({
  background: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden' },
  oval: { position: 'absolute', width: 360, height: 440, borderRadius: 220, borderWidth: 1, top: -190, end: -150, opacity: 0.35, transform: [{ rotate: '-28deg' }] },
  circle: { position: 'absolute', width: 210, height: 210, borderRadius: 105, borderWidth: 1, top: 110, start: -155, opacity: 0.16 },
});
