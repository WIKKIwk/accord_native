import { RNHostView, Surface } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding } from '@expo/ui/jetpack-compose/modifiers';
import { StyleSheet, Text } from 'react-native';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { useAdminFontsReady } from './AdminTypography.android';
import type { AdminFixedSnackBarContentProps } from './AdminFixedSnackBarTypes';
import { adminFontNames } from './adminFontFamily.android';

/** Plain Source M3 fixed SnackBar: rectangular inverse Material6, bodyMedium14/20, content24/14. */
export function AdminFixedSnackBarContent({ entry, palette, safeLeft, safeRight }: AdminFixedSnackBarContentProps) {
  const fonts = useAdminFontsReady(), theme = useBaseTheme();
  const leading = theme.direction === 'rightToLeft' ? safeRight : safeLeft, trailing = theme.direction === 'rightToLeft' ? safeLeft : safeRight;
  return <BaseHost matchContents={{ vertical: true }} style={styles.width}><Surface color={palette.inverseSurface} shadowElevation={6} tonalElevation={0} modifiers={[fillMaxWidth()]}>
    <RNHostView matchContents={{ vertical: true }} modifiers={[fillMaxWidth(), padding(leading + 24, 14, trailing + 24, 14)]}>
      <Text style={[styles.text, { color: palette.onInverseSurface, fontFamily: fonts ? adminFontNames.regular : undefined,
        textAlign: theme.direction === 'rightToLeft' ? 'right' : 'left', writingDirection: theme.direction === 'rightToLeft' ? 'rtl' : 'ltr' }]}>{entry.message}</Text>
    </RNHostView>
  </Surface></BaseHost>;
}
const styles = StyleSheet.create({ width: { width: '100%' }, text: { fontSize: 14, fontWeight: '400', lineHeight: 20, letterSpacing: .25, includeFontPadding: false } });
