import { Column, RNHostView, Row, Shape, Spacer, Surface, TextButton } from '@expo/ui/jetpack-compose';
import { defaultMinSize, fillMaxWidth, height, padding, size, testID, weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { Text as NativeText, StyleSheet, View } from 'react-native';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { AdminText as Text, useAdminFontsReady } from './AdminTypography.android';
import { adminTextStyle } from './adminFontFamily.android';
import type { AdminProgressQrTechnicalMaterialProps } from './AdminProgressQrTechnicalMaterialTypes';
import { useAdminProgressQrTechnicalMaterial } from './useAdminProgressQrTechnicalMaterial';

/** @v2 _TechnicalRawMaterialSection / _InfoRow
 * The actual report branch owns mounting; native text retains Source selection. */
export function AdminProgressQrTechnicalMaterial(props: AdminProgressQrTechnicalMaterialProps) {
  const model = useAdminProgressQrTechnicalMaterial(props), { colors } = useBaseTheme(), ready = useAdminFontsReady(); if (!model.visible) return null;
  return <View style={styles.card}><BaseHost matchContents={{ vertical: true }} style={styles.width}><Surface color={colors.surfaceContainerHighest} shape={Shape.RoundedCorner({ cornerRadii: { topStart: 12, topEnd: 12, bottomStart: 12, bottomEnd: 12 } })}><Column modifiers={[fillMaxWidth(), padding(0, 1, 0, 1)]}>
    <TextButton onClick={model.toggle} contentPadding={{ start: 16, top: 8, end: 24, bottom: 8 }} colors={{ contentColor: colors.onSurface }} modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 56 }), testID('admin-qr-material-technical-toggle')]}>
      <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}><Text style={{ typography: 'bodyLarge', fontWeight: '900' }} modifiers={[weight(1)]}>{model.title}</Text><Spacer modifiers={[size(16, 1)]} /><RNHostView matchContents><SymbolView name={{ android: model.expanded ? 'expand_less' : 'expand_more' }} size={24} tintColor={model.expanded ? colors.primary : colors.onSurfaceVariant} importantForAccessibility="no" /></RNHostView></Row>
    </TextButton>
    {model.expanded ? <Column modifiers={[fillMaxWidth(), padding(16, 0, 16, 16), testID('admin-qr-material-technical-rows')]}>{model.rows.map(row => <Column key={row.id} modifiers={[fillMaxWidth(), padding(0, 0, 0, 10), testID(`admin-qr-material-${row.id}`)]}>
      <Text color={colors.onSurfaceVariant} style={{ typography: 'labelLarge', fontWeight: '700' }}>{row.label}</Text><Spacer modifiers={[height(3)]} /><RNHostView matchContents={{ vertical: true }} modifiers={[fillMaxWidth()]}><NativeText selectable style={{ color: colors.onSurface, fontSize: 16, fontWeight: '700', lineHeight: 24, letterSpacing: .5, fontFamily: adminTextStyle({ fontWeight: '700' }, ready).fontFamily }}>{row.value}</NativeText></RNHostView>
    </Column>)}</Column> : null}
  </Column></Surface></BaseHost><View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderTopWidth: 1, borderBottomWidth: 1, borderColor: model.expanded ? colors.outlineVariant : 'transparent' }]} testID="admin-qr-material-technical-border" /></View>;
}
const styles = StyleSheet.create({ card: { width: '100%', marginBottom: 12 }, width: { width: '100%' } });
