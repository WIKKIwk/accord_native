import { Icon, RNHostView, Row, Spacer, Surface } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding, size, weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { StyleSheet, Text } from 'react-native';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { adminFontNames } from './adminFontFamily.android';
import { useAdminFontsReady } from './AdminTypography.android';
import type { AdminTopNoticeContentProps } from './AdminTopNoticeTypes';
import { adminTopNoticeColors } from './adminTopNoticeModel';

/** @v2 _adminNoticeBanner */
export function AdminTopNoticeContent({ banner }: AdminTopNoticeContentProps) {
  const colors = adminTopNoticeColors(banner.tone), theme = useBaseTheme(), fonts = useAdminFontsReady();
  return <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Surface color={colors.background} shadowElevation={0} modifiers={[fillMaxWidth()]}>
    <Row verticalAlignment="center" modifiers={[fillMaxWidth(), padding(16, 12, 16, 12)]}>
      {banner.icon ? <>{banner.icon.androidSymbol ? <RNHostView matchContents><SymbolView name={{ android: banner.icon.androidSymbol }} size={24} tintColor={theme.colors.onSurface} importantForAccessibility="no" /></RNHostView>
        : <Icon source={banner.icon.androidSource} size={24} tint={theme.colors.onSurface} />}<Spacer modifiers={[size(16, 1)]} /></> : null}
      <RNHostView matchContents={{ vertical: true }} modifiers={[weight(1)]}><Text maxFontSizeMultiplier={1.5} style={[styles.text, { color: colors.foreground, fontFamily: fonts ? adminFontNames.regular : undefined,
        textAlign: theme.direction === 'rightToLeft' ? 'right' : 'left', writingDirection: theme.direction === 'rightToLeft' ? 'rtl' : 'ltr' }]}>{banner.message}</Text></RNHostView>
      {/* Source's single SizedBox.shrink action still has horizontal8+8 action-bar padding. */}<Spacer modifiers={[size(16, 1)]} />
    </Row>
  </Surface></BaseHost>;
}
const styles = StyleSheet.create({ fullWidth: { width: '100%' }, text: { fontSize: 14, fontWeight: '400', lineHeight: 20, letterSpacing: .25, includeFontPadding: false } });
