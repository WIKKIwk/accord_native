import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Session } from '../auth';
import { dailyWorkDate, dailyWorkLocation, dailyWorkQuantity, dailyWorkStatus, type DailyWorkBatch } from '../dailyWork';
import { useDailyWork } from './useDailyWork';
import { useWorkerColors } from './useWorkerColors';
import { useDailyWorkActions } from './useDailyWorkActions';
import { DailyWorkDialogs } from './DailyWorkDialogs';
import { WorkerIconButton } from './WorkerIconButton';
import { useWorkerOrderText } from './useWorkerOrderText';

type Props = { session: Session; onOpenDrawer?: () => void; onBack: () => void };

export function DailyWorkScreen({ session, onOpenDrawer, onBack }: Props) {
  const colors = useWorkerColors();
  const model = useDailyWork(session);
  const { day, setDay, batches, apparatusNames, groups, totals, error, refreshing, refresh } = model;
  const actions = useDailyWorkActions(session, model), { p } = useWorkerOrderText();
  const [showDate, setShowDate] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { onBack(); return true; });
    return () => listener.remove();
  }, [onBack]);
  const showDetails = (batch: DailyWorkBatch) => {
    const rows = [
      `Holat: ${dailyWorkStatus(batch)}`,
      `Miqdor: ${dailyWorkQuantity(batch)}`,
      batch.weight == null ? '' : `Vazn: ${batch.weight} kg`,
      batch.bobina == null ? '' : `Bobina: ${batch.bobina} kg`,
      batch.diameter == null ? '' : `Diametr: ${batch.diameter} mm`,
      batch.started ? `Boshlangan: ${dailyWorkDate(batch.started)}` : '',
      batch.completed ? `Yakunlangan: ${dailyWorkDate(batch.completed)}` : '',
      dailyWorkLocation(batch.apparatus, apparatusNames) ? `Aparat: ${dailyWorkLocation(batch.apparatus, apparatusNames)}` : '',
      dailyWorkLocation(batch.location, apparatusNames) ? `Joylashuv: ${dailyWorkLocation(batch.location, apparatusNames)}` : '',
      dailyWorkLocation(batch.nextApparatus, apparatusNames) ? `Keyingi aparat: ${dailyWorkLocation(batch.nextApparatus, apparatusNames)}` : '',
      batch.worker ? `Ishchi: ${batch.worker}` : '',
      batch.qr ? `QR: ${batch.qr}` : '',
      batch.description ? `Izoh: ${batch.description}` : '',
    ].filter(Boolean);
    Alert.alert(batch.title || 'WIP ma’lumotlari', rows.join('\n'));
  };

  return <View style={[styles.root, { backgroundColor: colors.background }]}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel={onOpenDrawer ? 'Bo‘limlar' : 'Orqaga'} onPress={onOpenDrawer ?? onBack} style={styles.headerButton}>
        <Text style={[styles.headerIcon, { color: colors.text }]}>{onOpenDrawer ? '☰' : '‹'}</Text>
      </Pressable>
      <Text style={[styles.title, { color: colors.text }]}>Kunlik ish</Text>
    </View>
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing && batches !== null} onRefresh={() => { void refresh(); }} />}>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Pressable onPress={() => setShowDate(true)} accessibilityRole="button" style={styles.dateRow}>
          <Text style={{ color: colors.text, fontSize: 16 }}>Sana</Text>
          <Text style={{ color: colors.icon, fontSize: 16 }}>{day.toLocaleDateString()}</Text>
        </Pressable>
        <View style={styles.metrics}>
          {[['Buyurtma', totals.orders], ['WIP', totals.wips], ['Ishlatilgan', totals.used]].map(([label, value]) => <View key={label} style={styles.metric}>
            <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
            <Text style={{ color: colors.muted }}>{label}</Text>
          </View>)}
        </View>
      </View>
      {batches === null && !error ? <ActivityIndicator /> : null}
      {error ? <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text style={{ color: colors.text }}>{error}</Text>
        <Pressable accessibilityRole="button" onPress={() => { void refresh(); }}><Text style={{ color: colors.icon }}>Qayta urinish</Text></Pressable>
      </View> : null}
      {batches !== null ? <Text style={[styles.section, { color: colors.muted }]}>Ishlab chiqarilgan WIP</Text> : null}
      {batches !== null && !groups.length ? <Text style={{ color: colors.muted }}>Bu kunda ishlar topilmadi.</Text> : null}
      {groups.map(group => <View key={group.key} style={[styles.card, { backgroundColor: colors.surface }]}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: !!expanded[group.key] }} onPress={() => setExpanded(current => ({ ...current, [group.key]: !current[group.key] }))} style={styles.group}>
          <View style={styles.flex}><Text style={[styles.groupTitle, { color: colors.text }]}>{group.title || group.orderId || 'Buyurtma'}</Text>
            {group.title && group.orderId && group.title !== group.orderId ? <Text style={{ color: colors.muted }}>{group.orderId}</Text> : null}</View>
          <Text style={{ color: colors.muted }}>{group.batches.length} WIP {expanded[group.key] ? '⌃' : '⌄'}</Text>
        </Pressable>
        {expanded[group.key] ? group.batches.map((batch, index) => <View key={`${batch.id}:${index}`} style={styles.batch}>
          <Pressable accessibilityRole="button" style={[styles.batch, styles.flex]} accessibilityHint={p('worker.daily.card.expand_hint')}
            onPress={() => showDetails(batch)} onLongPress={() => actions.showQr(batch)} delayLongPress={500}>
          <View style={styles.flex}><Text style={{ color: colors.text }}>WIP {index + 1}</Text><Text style={{ color: colors.muted }}>{dailyWorkStatus(batch)}</Text></View>
          <Text style={{ color: colors.muted }}>{dailyWorkQuantity(batch)} ›</Text>
          </Pressable>
          {actions.canEdit(batch) ? <WorkerIconButton icon="edit" label={p('worker.daily.edit_wip')} onPress={() => actions.edit(batch)} /> : null}
        </View>) : null}
      </View>)}
      {batches && batches.length >= 200 ? <Text style={{ color: colors.muted }}>So‘nggi 200 ta yozuv ko‘rsatilmoqda.</Text> : null}
    </ScrollView>
    {showDate ? <DateTimePicker value={day} mode="date" minimumDate={new Date(2020, 0, 1)} maximumDate={new Date()}
      onValueChange={(_event, date) => { setDay(date); setShowDate(false); }} onDismiss={() => setShowDate(false)} /> : null}
    <DailyWorkDialogs session={session} model={model} actions={actions} />
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 }, flex: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 56, gap: 12 },
  headerButton: { minWidth: 40, minHeight: 44, justifyContent: 'center' }, headerIcon: { fontSize: 26 }, title: { fontSize: 23, fontWeight: '700' },
  content: { padding: 16, gap: 12, paddingBottom: 32 }, card: { borderRadius: 16, padding: 16, gap: 12 },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 36 }, metrics: { flexDirection: 'row', gap: 12 },
  metric: { flex: 1, gap: 3 }, metricValue: { fontSize: 21, fontWeight: '700' }, section: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  group: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 42 }, groupTitle: { fontSize: 16, fontWeight: '600' },
  batch: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingLeft: 12 },
});
