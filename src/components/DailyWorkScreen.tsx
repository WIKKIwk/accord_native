import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Session } from '../auth';
import { dailyWorkQuantity } from '../dailyWork';
import { dailyWorkDateDraft, dailyWorkDayLabel, dailyWorkDisplayCode, dailyWorkExpandedRows, dailyWorkProductTitle, dailyWorkStatusLabel } from '../dailyWorkPresentation';
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
  const actions = useDailyWorkActions(session, model), { p, t } = useWorkerOrderText();
  const [showDate, setShowDate] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [expandedWips, setExpandedWips] = useState<Record<string, boolean>>({});
  const workerName = String(session.profile.display_name || session.profile.legal_name || '').trim();
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { onBack(); return true; });
    return () => listener.remove();
  }, [onBack]);

  return <View style={[styles.root, { backgroundColor: colors.background }]}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel={onOpenDrawer ? 'Bo‘limlar' : 'Orqaga'} onPress={onOpenDrawer ?? onBack} style={styles.headerButton}>
        <Text style={[styles.headerIcon, { color: colors.text }]}>{onOpenDrawer ? '☰' : '‹'}</Text>
      </Pressable>
      <Text style={[styles.title, { color: colors.text }]}>{p('worker.daily')}</Text>
    </View>
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing && batches !== null} onRefresh={() => { void refresh(); }} />}>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Pressable onPress={() => setShowDate(true)} accessibilityRole="button" style={styles.dateRow}>
          <Text style={{ color: colors.text, fontSize: 16 }}>{p('worker.action.select')}</Text>
          <Text style={{ color: colors.icon, fontSize: 16 }}>{dailyWorkDayLabel(day)}</Text>
        </Pressable>
        {workerName ? <Text style={{ color: colors.text }}>{workerName}</Text> : null}
        <View style={styles.metrics}>
          {[[p('worker.daily.order'), totals.orders], ['WIP', totals.wips], [p('worker.daily.used'), totals.used]].map(([label, value]) => <View key={label} style={styles.metric}>
            <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
            <Text style={{ color: colors.muted }}>{label}</Text>
          </View>)}
        </View>
      </View>
      {batches === null && !error ? <ActivityIndicator /> : null}
      {error ? <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text style={{ color: colors.text }}>{p('worker.daily.load_failed')}</Text>
        <Pressable accessibilityRole="button" onPress={() => { void refresh(); }}><Text style={{ color: colors.icon }}>{t('Qayta urinish')}</Text></Pressable>
      </View> : null}
      {batches !== null ? <Text style={[styles.section, { color: colors.muted }]}>{p('worker.daily.produced_wips')}</Text> : null}
      {batches !== null && !groups.length ? <Text style={{ color: colors.muted }}>{p('worker.daily.empty')}</Text> : null}
      {groups.map(group => <View key={group.key} style={[styles.card, { backgroundColor: colors.surface }]}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: !!expanded[group.key] }} onPress={() => { setExpanded(current => ({ ...current, [group.key]: !current[group.key] })); if (expanded[group.key]) setExpandedWips(current => Object.fromEntries(Object.entries(current).filter(([id]) => !group.batches.some(batch => batch.id === id)))); }} style={styles.group}>
          <View style={styles.flex}><Text style={{ color: colors.muted }}>{p('worker.daily.order')}</Text><Text style={[styles.groupTitle, { color: colors.text }]}>{group.title && group.title.toLowerCase() !== group.orderId.toLowerCase() ? group.title : group.orderId}</Text>
            {group.title && group.orderId && group.title !== group.orderId ? <Text style={{ color: colors.muted }}>{group.orderId}</Text> : null}</View>
          <Text style={{ color: colors.muted }}>{group.batches.length} {p('worker.daily.wip')} {expanded[group.key] ? '⌃' : '⌄'}</Text>
        </Pressable>
        {expanded[group.key] ? group.batches.map((batch, index) => <View key={`${batch.id}:${index}`} style={{ gap: 8, paddingVertical: 10 }}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: !!expandedWips[batch.id] }}
            accessibilityHint={p(expandedWips[batch.id] ? 'worker.daily.card.collapse_hint' : 'worker.daily.card.expand_hint')}
            onPress={() => setExpandedWips(current => ({ ...current, [batch.id]: !current[batch.id] }))} onLongPress={() => actions.showQr(batch)} delayLongPress={500}>
            <View style={styles.batch}><Text style={{ color: colors.text }}>{index + 1}</Text>
              <Text style={[styles.flex, { color: colors.text }]}>{dailyWorkProductTitle(batch, index + 1)}</Text>
              <Text style={{ color: colors.muted }}>{dailyWorkStatusLabel(batch, p)} {expandedWips[batch.id] ? '⌃' : '⌄'}</Text>
            </View>
            {session.profile.role === 'rezka_master' ? <Text style={{ color: colors.muted }}>{p('worker.wip.info.worker')}: {batch.worker || '—'}</Text> : null}
            {expandedWips[batch.id] && actions.canEdit(batch) ? <WorkerIconButton icon="edit" label={p('worker.daily.edit_wip')} onPress={() => actions.edit(batch)} /> : null}
            {(expandedWips[batch.id] ? dailyWorkExpandedRows(batch, apparatusNames, p, session.assigned_apparatus) : [
              [p('worker.wip.info.qr'), dailyWorkDisplayCode(batch)], [p('worker.daily.field.length'), dailyWorkQuantity(batch)],
            ]).map(([label, value]) => <View key={label} style={{ paddingTop: 5 }}><Text style={{ color: colors.muted }}>{label}</Text><Text style={{ color: colors.text }}>{value}</Text></View>)}
            <Text style={{ color: colors.muted, paddingTop: 8 }}>{p(expandedWips[batch.id] ? 'worker.daily.card.collapse_hint' : 'worker.daily.card.expand_hint')}</Text>
          </Pressable>
        </View>) : null}
      </View>)}
    </ScrollView>
    {showDate ? <DateTimePicker value={dailyWorkDateDraft(day, new Date())} mode="date" minimumDate={new Date(2020, 0, 1)} maximumDate={new Date()}
      positiveButton={{ label: p('worker.action.select') }} negativeButton={{ label: p('worker.action.cancel') }}
      onValueChange={(_event, date) => { setDay(dailyWorkDateDraft(date, new Date())); setShowDate(false); }} onDismiss={() => setShowDate(false)} /> : null}
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
