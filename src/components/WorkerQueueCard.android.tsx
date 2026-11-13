import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
  children: ReactNode; backgroundColor: ViewStyle['backgroundColor']; backgroundImage?: ViewStyle['backgroundImage'];
  style?: StyleProp<ViewStyle>; containerStyle?: StyleProp<ViewStyle>;
  first?: boolean; last?: boolean; onPress?: () => void; onLongPress?: () => void; disabled?: boolean;
};

export function WorkerQueueCard({ children, backgroundColor, backgroundImage, first = false, last = false, onPress, onLongPress, disabled = false, style, containerStyle }: Props) {
  const cardStyle = [styles.row, {
    backgroundColor, backgroundImage,
    borderTopLeftRadius: first ? 16 : 4, borderTopRightRadius: first ? 16 : 4,
    borderBottomLeftRadius: last ? 16 : 4, borderBottomRightRadius: last ? 16 : 4,
  }, style];
  return <View style={[styles.inset, { paddingTop: first ? 0 : 1, paddingBottom: last ? 12 : 1 }, containerStyle]}>
    {onPress || onLongPress ? <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} onLongPress={onLongPress}
      accessibilityActions={!onPress && onLongPress ? [{ name: 'activate' }] : undefined}
      onAccessibilityAction={!onPress && onLongPress ? event => { if (event.nativeEvent.actionName === 'activate') onLongPress(); } : undefined}
      android_ripple={{}} style={cardStyle}>{children}</Pressable>
      : <View style={cardStyle}>{children}</View>}
  </View>;
}

const styles = StyleSheet.create({
  inset: { paddingHorizontal: 8 },
  row: { minHeight: 56, paddingHorizontal: 8, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
});
