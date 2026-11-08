import { Button, Column, Host, ListItem } from '@expo/ui';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Session } from '../auth';
import { useWorkerColors } from '../components/useWorkerColors';
import { localizedGetter, productionText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import type { AdminWorkMapController, AdminWorkMapDetailTicket, AdminWorkMapRow } from './adminWorkMapController';
import { adminWorkMapDetailReader } from './adminWorkMapReader';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const localeNow = () => localeController.locale;
export function AdminWorkMapDetail({ session, isCurrent, controller, row, ticket, close }: { session: Session; isCurrent: () => boolean;
  controller: AdminWorkMapController; row: AdminWorkMapRow; ticket: AdminWorkMapDetailTicket; close: () => void }) {
  const colors = useWorkerColors(), locale = useSyncExternalStore(subscribeLocale, localeNow, localeNow);
  useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const valid = controller.detailIsCurrent(ticket), [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ attempt: number; value?: Awaited<ReturnType<ReturnType<typeof adminWorkMapDetailReader>>>; error?: string } | null>(null);
  const currentResult = result?.attempt === attempt ? result : null;
  useEffect(() => { if (!valid) close(); }, [valid, close]);
  useEffect(() => {
    if (!valid) return;
    let mounted = true;
    void adminWorkMapDetailReader(session, isCurrent)(ticket).then(value => {
      if (mounted && controller.detailIsCurrent(ticket)) setResult({ attempt, value });
    }, error => {
      if (mounted && controller.detailIsCurrent(ticket)) setResult({ attempt, error: error instanceof Error ? error.message : String(error) });
    });
    return () => { mounted = false; };
  }, [session, isCurrent, controller, ticket, valid, attempt]);
  if (!valid) return <View style={{ flex: 1 }} />;
  const value = currentResult?.value, data = value?.kind === 'order' ? value.map : value?.template;
  const title = value?.kind === 'order' ? value.map.title : value?.template.product;
  const customer = value?.kind === 'order' ? value.map.customer_name : value?.template.customer;
  const weight = value?.kind === 'order' ? value.map.order_kg : value?.template.kg;
  const length = value?.kind === 'order' ? value.map.base_length : null;
  const width = data?.width_mm;
  return <View style={[styles.screen, { backgroundColor: colors.field }]}><ScrollView contentContainerStyle={styles.content}>
    <Text style={[styles.title, { color: colors.text }]}>{[row.code || row.id, title || row.title].filter(Boolean).join(' • ')}</Text>
    {!currentResult && <ActivityIndicator />}
    {currentResult?.error && <><Text accessibilityRole="alert" style={{ color: colors.text }}>{currentResult.error}</Text>
      <Host matchContents={{ vertical: true }}><Button label={localizedGetter('retry', locale)} onPress={() => setAttempt(value => value + 1)} /></Host></>}
    {data && <Host matchContents={{ vertical: true }}><Column>
      {!!customer && <ListItem supportingText={customer}>{localizedGetter('customerLabel', locale)}</ListItem>}
      {typeof weight === 'number' && Number.isFinite(weight) && <ListItem supportingText={`${weight} kg`}>{productionText('worker.summary.weight', locale)}</ListItem>}
      {typeof length === 'number' && Number.isFinite(length) && <ListItem supportingText={`${length} m`}>{productionText('worker.summary.length', locale)}</ListItem>}
      {typeof width === 'number' && Number.isFinite(width) && <ListItem supportingText={`${width} mm`}>{productionText('worker.summary.material_width', locale)}</ListItem>}
    </Column></Host>}
    <Host matchContents={{ vertical: true }}><Button label={localizedGetter('closeAction', locale)} onPress={close} /></Host>
  </ScrollView></View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, content: { padding: 16, gap: 12 }, title: { fontSize: 20, fontWeight: '700' } });
