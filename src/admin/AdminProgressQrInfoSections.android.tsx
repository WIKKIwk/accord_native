import { Column, RNHostView, Row, Shape, Spacer, Surface } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, height, padding, size, testID, weight } from '@expo/ui/jetpack-compose/modifiers';
import { StyleSheet, Text as NativeText } from 'react-native';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { AdminText as Text, useAdminFontsReady } from './AdminTypography.android';
import { adminTextStyle } from './adminFontFamily.android';
import type { AdminProgressQrInfoSection, AdminProgressQrOrderDetailsProps, AdminProgressQrQueueStatesProps } from './AdminProgressQrInfoSectionsTypes';
import { adminProgressQrOrderDetailsModel, adminProgressQrQueueStatesModel } from './adminProgressQrInfoSectionModel';

/** @v2 _InfoSection / _InfoRow. Read-only native card; value selection is the only interaction. */
export function AdminProgressQrInfoSectionCard({ section }: { section: AdminProgressQrInfoSection | null }) {
  const { colors } = useBaseTheme(), ready = useAdminFontsReady(); if (!section) return null;
  return <BaseHost matchContents={{ vertical: true }} style={styles.card}><Surface color={colors.surfaceContainerHighest} contentColor={colors.onSurface} tonalElevation={0} shadowElevation={0}
    shape={Shape.RoundedCorner({ cornerRadii: { topStart: 12, topEnd: 12, bottomStart: 12, bottomEnd: 12 } })}>
    <Column modifiers={[fillMaxWidth(), padding(16, 16, 16, 16), testID(`admin-qr-info-${section.id}`)]}>
      <Text style={{ typography: 'titleMedium', fontWeight: '900', lineHeight: 24, letterSpacing: .15 }}>{section.title}</Text><Spacer modifiers={[height(12)]} />
      {'rows' in section ? section.rows.map(row => <Column key={row.id} modifiers={[fillMaxWidth(), padding(0, 0, 0, 10), testID(`admin-qr-info-${section.id}-${row.id}`)]}>
        <Text color={colors.onSurfaceVariant} style={{ typography: 'labelLarge', fontWeight: '700', lineHeight: 22.88, letterSpacing: .1 }}>{row.label}</Text><Spacer modifiers={[height(3)]} />
        <RNHostView matchContents={{ vertical: true }} modifiers={[fillMaxWidth()]}><NativeText selectable style={{ color: colors.onSurface, fontSize: 16, fontWeight: '700', lineHeight: 24, letterSpacing: .5, fontFamily: adminTextStyle({ fontWeight: '700' }, ready).fontFamily }}>{row.value}</NativeText></RNHostView>
      </Column>) : section.lines.map((line, index) => <Row key={index} verticalAlignment="top" modifiers={[fillMaxWidth(), padding(0, 0, 0, 10), testID(`admin-qr-info-${section.id}-${index}`)]}>
        <Column modifiers={[padding(0, 8, 0, 0)]}><Surface color={colors.primary} shape={Shape.Circle({})} modifiers={[size(7, 7)]} /></Column><Spacer modifiers={[size(10, 1)]} />
        <RNHostView matchContents={{ vertical: true }} modifiers={[weight(1)]}><NativeText selectable style={{ color: colors.onSurface, fontSize: 16, fontWeight: '700', lineHeight: 21.6, letterSpacing: .5, fontFamily: adminTextStyle({ fontWeight: '700' }, ready).fontFamily }}>{line}</NativeText></RNHostView>
      </Row>)}
    </Column>
  </Surface></BaseHost>;
}
/** @v2 _OrderDetailsSection */
export function AdminProgressQrOrderDetails(props: AdminProgressQrOrderDetailsProps) { return <AdminProgressQrInfoSectionCard section={adminProgressQrOrderDetailsModel(props)} />; }
/** @v2 _QueueStatesSection */
export function AdminProgressQrQueueStates(props: AdminProgressQrQueueStatesProps) { return <AdminProgressQrInfoSectionCard section={adminProgressQrQueueStatesModel(props)} />; }
const styles = StyleSheet.create({ card: { width: '100%', marginBottom: 12 } });
