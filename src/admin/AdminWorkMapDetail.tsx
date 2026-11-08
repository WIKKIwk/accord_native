import { Button, Column, Host, ListItem } from '@expo/ui';
import { useSyncExternalStore } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Session } from '../auth';
import { useWorkerColors } from '../components/useWorkerColors';
import { WorkerIconButton } from '../components/WorkerIconButton';
import { adminText, extensionText, localizedGetter, productionText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import type { AdminWorkMapController, AdminWorkMapDetailTicket, AdminWorkMapRow } from './adminWorkMapController';
import { useAdminWorkMapDetail } from './useAdminWorkMapDetail';
import { AdminWorkMapMetadata } from './AdminWorkMapMetadata';
import { adminWorkMapMetadataRows } from './adminWorkMapMetadataModel';
import { useAdminWorkMapSummary } from './useAdminWorkMapSummary';
import { adminWorkMapSummaryPresentation } from './adminWorkMapSummaryPresentation';
import { AdminWorkMapSummary } from './AdminWorkMapSummary';
import { adminWorkMapDetailHeader } from './adminWorkMapDetailHeader';
import { AdminWorkMapCombo } from './AdminWorkMapCombo';
import { adminWorkMapComboPresentation } from './adminWorkMapComboPresentation';
import { AdminWorkMapPending } from './AdminWorkMapPending';
import { adminWorkMapPendingPresentation } from './adminWorkMapPendingPresentation';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const localeNow = () => localeController.locale;
export function AdminWorkMapDetail({ session, isCurrent, controller, row, ticket, close }: { session: Session; isCurrent: () => boolean;
  controller: AdminWorkMapController; row: AdminWorkMapRow; ticket: AdminWorkMapDetailTicket; close: () => void }) {
  const colors = useWorkerColors(), locale = useSyncExternalStore(subscribeLocale, localeNow, localeNow);
  const detail = useAdminWorkMapDetail(session, isCurrent, controller, ticket, close);
  const showSummary = ticket.kind === 'order' && (session.profile.role === 'admin' || session.profile.role === 'brigader');
  const summary = useAdminWorkMapSummary(session, isCurrent, controller, ticket, showSummary && detail.valid && detail.value?.kind === 'order' ? detail.value : false);
  if (!detail.valid) return <View style={{ flex: 1 }} />;
  const value = detail.value, data = value?.kind === 'order' ? value.map : value?.template;
  const title = value?.kind === 'order' ? value.map.title : value?.template.product;
  const customer = value?.kind === 'order' ? value.customer : value?.template.customer;
  const pending = ticket.kind === 'pending' && value?.kind === 'pending' ? adminWorkMapPendingPresentation(value.template, value.managerName) : null;
  const header = ticket.kind === 'order' ? adminWorkMapDetailHeader(row, value?.kind === 'order' ? value.map : null,
    value?.kind === 'order' ? value.customer : row.customer, productionText('worker.order.fallback', locale)) : null;
  const weight = value?.kind === 'order' ? value.map.order_kg : value?.template.kg;
  const length = value?.kind === 'order' ? value.map.base_length : null;
  const width = data?.width_mm;
  const combo = showSummary && value?.kind === 'order' && value.map.combo && value.map.products.length
    ? adminWorkMapComboPresentation(value.map.combo, value.map.products, locale) : null;
  const metadata = adminWorkMapMetadataRows(value?.kind === 'order' ? value.metadata : null, session.profile.role, ticket.kind,
    { admin: key => adminText(key, locale), loading: localizedGetter('loading', locale) });
  return <View style={[styles.screen, { backgroundColor: colors.field }]}><ScrollView contentContainerStyle={[styles.content, ticket.kind === 'order' && styles.openedContent]}>
    {header ? <View><Text style={{ color: colors.text }}>{productionText('worker.order.code', locale)}</Text>
      <Text style={[styles.title, { color: colors.text }]}>{header.code}</Text>
      <Text style={[styles.title, { color: colors.text }]}>{header.label}</Text></View>
      : <Text style={[styles.title, styles.pendingTitle, { color: colors.text }]}>{pending?.title ?? [row.code || row.id, title || row.title].filter(Boolean).join(' • ')}</Text>}
    {showSummary && value?.kind === 'order' && value.qolipInRework && <View testID="admin-qolip-rework-notice" style={[styles.notice, { backgroundColor: colors.field }]}>
      <Text style={[styles.noticeText, { color: colors.muted }]}>{extensionText('qolipReworkText', 'order_unavailable', locale)}</Text></View>}
    {detail.loading && <ActivityIndicator />}
    {detail.error && <><Text accessibilityRole="alert" style={{ color: colors.text }}>{detail.error}</Text>
      <Host matchContents={{ vertical: true }}><Button label={localizedGetter('retry', locale)} onPress={detail.retry} /></Host></>}
    {(metadata.length > 0 || data) && <Host matchContents={{ vertical: true }}><Column>
      {!header && !pending && !!customer && <ListItem supportingText={customer}>{localizedGetter('customerLabel', locale)}</ListItem>}
      {metadata.length > 0 && <AdminWorkMapMetadata rows={metadata} />}
      {combo && <AdminWorkMapCombo key={value?.kind === 'order' ? value.map.id : undefined} model={combo} />}
      {pending ? <AdminWorkMapPending rows={pending.rows} /> : showSummary ? <AdminWorkMapSummary model={adminWorkMapSummaryPresentation(value?.kind === 'order'
        ? { ...value.map, order_kg: value.orderWeight ?? value.map.order_kg } : null, summary, locale)} onToggle={summary.toggle} onRetry={summary.retry} /> : <>
        {typeof weight === 'number' && Number.isFinite(weight) && <ListItem supportingText={`${weight} kg`}>{productionText('worker.summary.weight', locale)}</ListItem>}
        {typeof length === 'number' && Number.isFinite(length) && <ListItem supportingText={`${length} m`}>{productionText('worker.summary.length', locale)}</ListItem>}
        {typeof width === 'number' && Number.isFinite(width) && <ListItem supportingText={`${width} mm`}>{productionText('worker.summary.material_width', locale)}</ListItem>}
      </>}
    </Column></Host>}
  </ScrollView><View style={styles.openedClose}><WorkerIconButton icon="close" label={productionText('worker.action.close', locale)} tonal={ticket.kind === 'order'} onPress={close} /></View></View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, content: { padding: 16, gap: 12 }, openedContent: { paddingTop: 56 },
  openedClose: { position: 'absolute', top: 4, right: 4 }, title: { fontSize: 20, fontWeight: '700' }, pendingTitle: { paddingRight: 48 },
  notice: { padding: 12, borderRadius: 12 }, noticeText: { fontWeight: '700' } });
