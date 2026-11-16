import { Text, VStack } from '@expo/ui/swift-ui';
import { background, font, foregroundStyle, frame, padding, shadow } from '@expo/ui/swift-ui/modifiers';
import { StyleSheet } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import type { AdminFixedSnackBarContentProps } from './AdminFixedSnackBarTypes';

/** Native SwiftUI text adapts the ordinary, noninteractive Source fixed SnackBar body. */
export function AdminFixedSnackBarContent({ entry, palette, safeLeft, safeRight }: AdminFixedSnackBarContentProps) {
  const theme = useBaseTheme(), leading = theme.direction === 'rightToLeft' ? safeRight : safeLeft, trailing = theme.direction === 'rightToLeft' ? safeLeft : safeRight;
  return <BaseHost matchContents={{ vertical: true }} style={styles.width}><VStack spacing={0} modifiers={[frame({ maxWidth: Infinity }), background(palette.inverseSurface), shadow({ radius: 6, y: 3, color: '#00000040' })]}>
    <Text modifiers={[font({ textStyle: 'subheadline', weight: 'regular' }), foregroundStyle(palette.onInverseSurface), frame({ maxWidth: Infinity, alignment: 'leading' }),
      padding({ leading: 24 + leading, top: 14, trailing: 24 + trailing, bottom: 14 })]}>{entry.message}</Text>
  </VStack></BaseHost>;
}
const styles = StyleSheet.create({ width: { width: '100%' } });
