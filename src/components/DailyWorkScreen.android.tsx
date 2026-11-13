import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { Box, Column, FilledTonalIconButton, Host, OutlinedCard, RNHostView, Row, Text as ComposeText, useMaterialColors, type MaterialColors } from '@expo/ui/jetpack-compose';
import { background, clickable, clip, combinedClickable, defaultMinSize, fillMaxWidth, padding, semantics, Shapes, size, testID, weight, width } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, BackHandler, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import type { Session } from '../auth';
import { dailyWorkQuantity, dailyWorkStatus, type DailyWorkBatch, type DailyWorkGroup } from '../dailyWork';
import { dailyWorkDateDraft, dailyWorkDayLabel, dailyWorkDisplayCode, dailyWorkExpandedRows, dailyWorkProductTitle, dailyWorkStatusLabel } from '../dailyWorkPresentation';
import { DailyWorkDialogs } from './DailyWorkDialogs';
import { useDailyWork } from './useDailyWork';
import { useDailyWorkActions } from './useDailyWorkActions';
import { useWorkerColors } from './useWorkerColors';
import { useWorkerOrderText } from './useWorkerOrderText';

type Props = { session: Session; onOpenDrawer?: () => void; onBack: () => void };
type Actions = ReturnType<typeof useDailyWorkActions>;
type Translate = ReturnType<typeof useWorkerOrderText>['p'];

// FlatList may unmount a row outside its window. Keep the user's open cards
// with the page so revisiting that row does not collapse it.
function useRowExpansion(key: string, saved?: Map<string, boolean>) {
  const [expanded, setExpanded] = useState(() => saved?.get(key) ?? false);
  const toggle = () => {
    if (!saved) { setExpanded(value => !value); return; }
    const next = !(saved.get(key) ?? expanded);
    saved.set(key, next);
    setExpanded(next);
  };
  return { expanded, toggle };
}

function CompactValue({ label, value, colors }: { label: string; value: string; colors: MaterialColors }) {
  return <Column verticalArrangement={{ spacedBy: 2 }} modifiers={[weight(1)]}>
    <ComposeText color={colors.onSurfaceVariant} style={{ typography: 'labelSmall' }}>{label}</ComposeText>
    <ComposeText color={colors.onSurface} maxLines={2} overflow="ellipsis" style={{ typography: 'bodySmall', fontWeight: '700' }}>{value}</ComposeText>
  </Column>;
}

function InfoRow({ row, colors }: { row: [string, string]; colors: MaterialColors }) {
  return <Row verticalAlignment="top" modifiers={[fillMaxWidth(), padding(0, 5, 0, 0)]}>
    <ComposeText color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }} modifiers={[width(110)]}>{row[0]}</ComposeText>
    <ComposeText color={colors.onSurface} style={{ typography: 'bodySmall', fontWeight: '600' }} modifiers={[weight(1)]}>{row[1]}</ComposeText>
  </Row>;
}

function DailyWorkIcon({ name, color, size: iconSize = 22 }: { name: 'receipt_long' | 'expand_less' | 'expand_more' | 'edit'; color: string; size?: number }) {
  return <RNHostView matchContents><SymbolView name={{ android: name }} size={iconSize} tintColor={color} accessible={false} /></RNHostView>;
}

/** @v2 _DailyWorkWipCardState */
function BatchCard({ batch, index, names, assigned, showWorker, actions, p, colors, expansion, expansionKey = batch.id }: {
  batch: DailyWorkBatch; index: number; names: Record<string, string>; assigned: readonly string[];
  showWorker: boolean; actions: Actions; p: Translate; colors: MaterialColors; expansion?: Map<string, boolean>; expansionKey?: string;
}) {
  const { expanded, toggle } = useRowExpansion(expansionKey, expansion);
  const status = dailyWorkStatus(batch);
  const statusBackground = status === 'Ishlatilgan' ? colors.secondaryContainer : status === 'Jarayonda' ? colors.tertiaryContainer : colors.primaryContainer;
  const statusForeground = status === 'Ishlatilgan' ? colors.onSecondaryContainer : status === 'Jarayonda' ? colors.onTertiaryContainer : colors.onPrimaryContainer;
  const rows = expanded ? dailyWorkExpandedRows(batch, names, p, assigned) : [];
  const metricCount = 1 + Number(batch.weight !== null) + Number(batch.bobina !== null) + Number(batch.diameter !== null);
  const locationsStart = 1 + metricCount + Number(batch.started > 0) + Number(batch.completed > 0);
  const metrics = rows.slice(1, 1 + metricCount);
  const timestamps = rows.slice(1 + metricCount, locationsStart);
  const locations = rows.slice(locationsStart, locationsStart + 2);
  const extra = rows.slice(locationsStart + 2);
  const hint = p(expanded ? 'worker.daily.card.collapse_hint' : 'worker.daily.card.expand_hint');

  return <Column modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(16)), background(colors.surfaceContainerHighest),
    testID(`daily-work-wip-card-${batch.id}`), combinedClickable({ onClick: toggle, onLongClick: () => actions.showQr(batch, { nativeFeedback: true }) }), padding(14, 14, 10, 14)]}>
      <Row verticalAlignment="top" horizontalArrangement={{ spacedBy: 6 }} modifiers={[fillMaxWidth()]}>
        <Box contentAlignment="center" modifiers={[size(32, 32), clip(Shapes.Circle), background(colors.secondaryContainer)]}>
          <ComposeText color={colors.onSecondaryContainer} style={{ typography: 'labelLarge', fontWeight: '700' }}>{String(index + 1)}</ComposeText>
        </Box>
        <ComposeText color={colors.onSurface} maxLines={2} overflow="ellipsis" style={{ typography: 'titleSmall', fontWeight: '800' }} modifiers={[weight(1)]}>{dailyWorkProductTitle(batch, index + 1)}</ComposeText>
        <Box modifiers={[clip(Shapes.RoundedCorner(999)), background(statusBackground), padding(8, 5, 8, 5)]}>
          <ComposeText color={statusForeground} style={{ typography: 'labelSmall', fontWeight: '800' }}>{dailyWorkStatusLabel(batch, p)}</ComposeText>
        </Box>
        <DailyWorkIcon name={expanded ? 'expand_less' : 'expand_more'} color={colors.onSurfaceVariant} />
      </Row>
      {showWorker ? <InfoRow row={[p('worker.wip.info.worker'), batch.worker || '—']} colors={colors} /> : null}
      {expanded ? <>
        {actions.canEdit(batch) ? <Row horizontalArrangement="end" modifiers={[fillMaxWidth(), padding(0, 6, 0, 0)]}>
          <FilledTonalIconButton onClick={() => actions.edit(batch)} modifiers={[size(40, 40), semantics({ contentDescription: p('worker.daily.edit_wip') })]}>
            <DailyWorkIcon name="edit" color={colors.onSecondaryContainer} size={20} />
          </FilledTonalIconButton>
        </Row> : null}
        <InfoRow row={rows[0]} colors={colors} />
        <Row verticalAlignment="top" horizontalArrangement={{ spacedBy: 10 }} modifiers={[fillMaxWidth(), padding(0, 8, 0, 0)]}>{metrics.map(([label, value]) => <CompactValue key={label} label={label} value={value} colors={colors} />)}</Row>
        {timestamps.map(row => <InfoRow key={row[0]} row={row} colors={colors} />)}
        <Row verticalAlignment="top" horizontalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth(), padding(0, 8, 0, 0)]}>{locations.map(([label, value]) => <CompactValue key={label} label={label} value={value} colors={colors} />)}</Row>
        {extra.map(row => <InfoRow key={row[0]} row={row} colors={colors} />)}
      </> : <Row verticalAlignment="top" horizontalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth(), padding(0, 10, 0, 0)]}>
        <CompactValue label={p('worker.wip.info.qr')} value={dailyWorkDisplayCode(batch)} colors={colors} />
        <CompactValue label={p('worker.daily.field.length')} value={dailyWorkQuantity(batch)} colors={colors} />
      </Row>}
      <ComposeText color={colors.onSurfaceVariant} style={{ typography: 'labelSmall' }} modifiers={[padding(0, 8, 0, 0)]}>{hint}</ComposeText>
  </Column>;
}

/** @v2 _DailyWorkOrderGroupCardState */
function OrderGroup({ group, names, assigned, showWorker, actions, p, colors, expansion }: {
  group: DailyWorkGroup; names: Record<string, string>; assigned: readonly string[]; showWorker: boolean;
  actions: Actions; p: Translate; colors: MaterialColors; expansion?: Map<string, boolean>;
}) {
  const { expanded, toggle } = useRowExpansion(`group:${group.key}`, expansion);
  const batchKey = (batch: DailyWorkBatch, index: number) => `batch:${group.key}:${batch.id}:${index}`;
  const title = group.title.trim(), orderId = group.orderId.trim();
  const hasTitle = !!title && title.toLowerCase() !== orderId.toLowerCase();
  return <Host matchContents={{ vertical: true }} style={styles.groupHost}>
    <OutlinedCard colors={{ containerColor: colors.surfaceContainerLow }} border={{ color: colors.outlineVariant, width: 1 }} modifiers={[fillMaxWidth()]}>
      <Column modifiers={[fillMaxWidth(), padding(8, 8, 8, 2)]}>
        <Row verticalAlignment="top" horizontalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 44 }),
          clip(Shapes.RoundedCorner(12)), testID(`daily-work-order-header-${group.key}`), clickable(() => {
            if (expanded) group.batches.forEach((batch, index) => expansion?.delete(batchKey(batch, index)));
            toggle();
          }), padding(8, 4, 4, 10)]}>
          <DailyWorkIcon name="receipt_long" size={20} color={colors.primary} />
          <Column verticalArrangement={{ spacedBy: 3 }} modifiers={[weight(1)]}>
            <ComposeText color={colors.onSurfaceVariant} maxLines={1} overflow="ellipsis" style={{ typography: 'labelSmall' }}>
              {p('worker.daily.order')}{hasTitle && orderId ? <ComposeText color={colors.primary} style={{ fontWeight: '700' }}>{` • ${orderId}`}</ComposeText> : null}
            </ComposeText>
            <ComposeText color={colors.onSurface} maxLines={2} overflow="ellipsis" style={{ typography: 'titleSmall', fontWeight: '800' }}>{hasTitle ? title : orderId}</ComposeText>
          </Column>
          <Box modifiers={[clip(Shapes.RoundedCorner(999)), background(colors.secondaryContainer), padding(9, 5, 9, 5)]}>
            <ComposeText color={colors.onSecondaryContainer} style={{ typography: 'labelSmall', fontWeight: '800' }}>{`${group.batches.length} ${p('worker.daily.wip')}`}</ComposeText>
          </Box>
          <DailyWorkIcon name={expanded ? 'expand_less' : 'expand_more'} color={colors.onSurfaceVariant} />
        </Row>
        {expanded ? <Column verticalArrangement={{ spacedBy: 10 }} modifiers={[fillMaxWidth(), padding(0, 2, 0, 10)]}>
          {group.batches.map((batch, index) => <BatchCard key={`${batch.id}:${index}`} batch={batch} index={index} names={names} assigned={assigned} showWorker={showWorker} actions={actions} p={p} colors={colors}
            expansion={expansion} expansionKey={batchKey(batch, index)} />)}
        </Column> : null}
      </Column>
    </OutlinedCard>
  </Host>;
}

export function DailyWorkScreen({ session, onOpenDrawer, onBack }: Props) {
  const colors = useWorkerColors(), material = useMaterialColors();
  const model = useDailyWork(session);
  const { day, setDay, batches, apparatusNames, groups, totals, error, refreshing, refresh } = model;
  const actions = useDailyWorkActions(session, model), { p, t } = useWorkerOrderText();
  const [showDate, setShowDate] = useState(false);
  const { expansion } = useMemo(() => ({ session, expansion: new Map<string, boolean>() }), [session]);
  const workerName = String(session.profile.display_name || session.profile.legal_name || '').trim();
  useEffect(() => {
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
    <FlatList style={styles.list} contentContainerStyle={styles.content} data={groups} keyExtractor={group => group.key} removeClippedSubviews={false}
      refreshControl={<RefreshControl refreshing={refreshing && batches !== null} onRefresh={() => { void refresh(); }} />}
      ListHeaderComponent={<View style={styles.headingContent}>
      <View style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
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
      {error ? <View style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
        <Text style={{ color: colors.text }}>{p('worker.daily.load_failed')}</Text>
        <Pressable accessibilityRole="button" onPress={() => { void refresh(); }}><Text style={{ color: colors.icon }}>{t('Qayta urinish')}</Text></Pressable>
      </View> : null}
      {batches !== null ? <Text style={[styles.section, { color: colors.muted }]}>{p('worker.daily.produced_wips')}</Text> : null}
      </View>}
      ListEmptyComponent={batches !== null ? <Text style={{ color: colors.muted }}>{p('worker.daily.empty')}</Text> : undefined}
      renderItem={({ item: group }) => <OrderGroup group={group} names={apparatusNames} assigned={session.assigned_apparatus}
        showWorker={session.profile.role === 'rezka_master'} actions={actions} p={p} colors={material} expansion={expansion} />} />
    {showDate ? <DateTimePicker value={dailyWorkDateDraft(day, new Date())} mode="date" minimumDate={new Date(2020, 0, 1)} maximumDate={new Date()}
      positiveButton={{ label: p('worker.action.select') }} negativeButton={{ label: p('worker.action.cancel') }}
      onValueChange={(_event, date) => { setDay(dailyWorkDateDraft(date, new Date())); setShowDate(false); }} onDismiss={() => setShowDate(false)} /> : null}
    <DailyWorkDialogs session={session} model={model} actions={actions} />
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 56, gap: 12 },
  headerButton: { minWidth: 40, minHeight: 44, justifyContent: 'center' }, headerIcon: { fontSize: 26 }, title: { fontSize: 23, fontWeight: '700' },
  list: { flex: 1, minHeight: 0 }, headingContent: { gap: 12 },
  content: { padding: 16, gap: 12, paddingBottom: 32 }, summaryCard: { borderRadius: 16, padding: 16, gap: 12 },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 36 }, metrics: { flexDirection: 'row', gap: 12 },
  metric: { flex: 1, gap: 3 }, metricValue: { fontSize: 21, fontWeight: '700' }, section: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  groupHost: { width: '100%' },
});
