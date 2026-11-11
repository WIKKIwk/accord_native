import { Button, DatePicker, Divider, Host, HStack, Image, List, NavigationStack, ProgressView, Section, Spacer, Text, Toolbar, ToolbarItem, VStack } from '@expo/ui/swift-ui';
import { accessibilityAddTraits, accessibilityElement, accessibilityIdentifier, accessibilityLabel, background, buttonStyle, contentShape, controlSize, cornerRadius, datePickerStyle, fixedSize, font, foregroundStyle, frame, labelStyle, layoutPriority, lineLimit, listRowBackground, listRowInsets, listRowSeparator, listStyle, navigationBarTitleDisplayMode, navigationTitle, onLongPressGesture, onTapGesture, padding, refreshable, scrollEdgeEffectStyle, shapes, strokeBorder } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { PlatformColor, StyleSheet, View } from 'react-native';
import type { Session } from '../auth';
import { dailyWorkQuantity, type DailyWorkBatch, type DailyWorkGroup } from '../dailyWork';
import { dailyWorkDateDraft, dailyWorkDayLabel, dailyWorkDisplayCode, dailyWorkExpandedRows, dailyWorkProductTitle, dailyWorkStatusLabel } from '../dailyWorkPresentation';
import { useDailyWork } from './useDailyWork';
import { useDailyWorkActions } from './useDailyWorkActions';
import { DailyWorkDialogs } from './DailyWorkDialogs';
import { useWorkerOrderText } from './useWorkerOrderText';
import { WorkerFormDialog } from './WorkerFormDialog';

type Props = { session: Session; onOpenDrawer?: () => void; onBack: () => void };
const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });

function createLongPressGate() {
  const held = new Set<string>();
  return { mark: (id: string) => { held.add(id); }, take: (id: string) => held.delete(id), reset: () => held.clear() };
}

function Metric({ label, value }: { label: string; value: number }) {
  return <VStack alignment="leading" spacing={3} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
    <Text modifiers={[font({ textStyle: 'title3', weight: 'semibold' })]}>{String(value)}</Text>
    <Text modifiers={[font({ textStyle: 'caption' }), secondary]}>{label}</Text>
  </VStack>;
}

function CompactValue({ label, value }: { label: string; value: string }) {
  return <VStack alignment="leading" spacing={4} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
    <Text modifiers={[font({ textStyle: 'caption' }), secondary]}>{label}</Text>
    <Text modifiers={[font({ textStyle: 'subheadline', weight: 'medium' }), lineLimit(1)]}>{value}</Text>
  </VStack>;
}

function BatchCard({ batch, index, names, assigned, showWorker, actions }: {
  batch: DailyWorkBatch; index: number; names: Record<string, string>; assigned: readonly string[]; showWorker: boolean;
  actions: ReturnType<typeof useDailyWorkActions>;
}) {
  const [expanded, setExpanded] = useState(false), { p } = useWorkerOrderText();
  const held = useMemo(() => createLongPressGate(), []);
  useEffect(() => { if (!actions.qrBatch && !actions.alert) held.reset(); }, [actions.qrBatch, actions.alert, held]);
  const rows = expanded ? dailyWorkExpandedRows(batch, names, p, assigned) : [];
  return <VStack alignment="leading" spacing={0} modifiers={[
    frame({ maxWidth: Infinity, alignment: 'leading' }), background(PlatformColor('tertiarySystemGroupedBackground')), cornerRadius(16),
    accessibilityIdentifier(`daily-work-wip-card-${batch.id}`),
  ]}>
    <VStack alignment="leading" spacing={12} modifiers={[
      padding({ all: 12 }), frame({ maxWidth: Infinity, alignment: 'leading' }), contentShape(shapes.rectangle()),
      onTapGesture(() => { if (!held.take(batch.id)) setExpanded(value => !value); }),
      onLongPressGesture(() => { held.mark(batch.id); actions.showQr(batch); }, 0.5),
      accessibilityElement('combine'), accessibilityAddTraits(['isButton']), accessibilityLabel(dailyWorkProductTitle(batch, index + 1)),
    ]}>
      <HStack alignment="top" spacing={10}>
        <Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' }), frame({ minWidth: 32, minHeight: 32 }),
          background(PlatformColor('tertiarySystemFill')), cornerRadius(16)]}>{String(index + 1)}</Text>
        <VStack alignment="leading" spacing={6} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), layoutPriority(1)]}>
          <Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' }), lineLimit(2), fixedSize({ horizontal: false, vertical: true })]}>{dailyWorkProductTitle(batch, index + 1)}</Text>
          <Text modifiers={[font({ textStyle: 'caption', weight: 'medium' }), secondary, padding({ horizontal: 8, vertical: 4 }),
            background(PlatformColor('quaternarySystemFill')), cornerRadius(8)]}>{dailyWorkStatusLabel(batch, p)}</Text>
        </VStack>
        <Image systemName={expanded ? 'chevron.up' : 'chevron.down'} size={13} modifiers={[secondary, padding({ top: 8 })]} />
      </HStack>
      {showWorker ? <CompactValue label={p('worker.wip.info.worker')} value={batch.worker || '—'} /> : null}
      {expanded ? <>
        <Divider />
        {rows.map(([label, value]) => <HStack key={label} alignment="top" spacing={12}>
          <Text modifiers={[font({ textStyle: 'caption' }), secondary, frame({ width: 88, alignment: 'leading' }), fixedSize({ horizontal: false, vertical: true })]}>{label}</Text>
          <Text modifiers={[font({ textStyle: 'subheadline' }), frame({ maxWidth: Infinity, alignment: 'leading' }), fixedSize({ horizontal: false, vertical: true })]}>{value}</Text>
        </HStack>)}
      </> : <HStack alignment="top" spacing={12}>
        <CompactValue label={p('worker.wip.info.qr')} value={dailyWorkDisplayCode(batch)} />
        <CompactValue label={p('worker.daily.field.length')} value={dailyWorkQuantity(batch)} />
      </HStack>}
      <Text modifiers={[font({ textStyle: 'caption' }), secondary]}>{p(expanded ? 'worker.daily.card.collapse_hint' : 'worker.daily.card.expand_hint')}</Text>
    </VStack>
    {expanded && actions.canEdit(batch) ? <HStack modifiers={[padding({ horizontal: 12, bottom: 12 })]}>
      <Spacer />
      <Button label={p('worker.daily.edit_wip')} systemImage="pencil" modifiers={[labelStyle('titleAndIcon'), buttonStyle('bordered'), controlSize('large'), frame({ minHeight: 44 })]}
        onPress={() => actions.edit(batch)} />
    </HStack> : null}
  </VStack>;
}

function BatchGroup({ group, names, assigned, showWorker, actions }: { group: DailyWorkGroup; names: Record<string, string>; assigned: readonly string[]; showWorker: boolean; actions: ReturnType<typeof useDailyWorkActions> }) {
  const [expanded, setExpanded] = useState(false), { p } = useWorkerOrderText();
  const hasTitle = group.title.trim() && group.title.trim().toLowerCase() !== group.orderId.trim().toLowerCase();
  return <VStack alignment="leading" spacing={12} modifiers={[
    padding({ all: 10 }), background(PlatformColor('secondarySystemGroupedBackground')), cornerRadius(20),
    strokeBorder({ color: PlatformColor('separator'), shape: 'roundedRectangle', cornerRadius: 20, style: { lineWidth: 1 } }),
    listRowInsets({ top: 0, bottom: 12, leading: 0, trailing: 0 }), listRowSeparator('hidden'), listRowBackground(PlatformColor('systemGroupedBackground')),
  ]}>
    <Button onPress={() => setExpanded(value => !value)} modifiers={[buttonStyle('plain'), accessibilityIdentifier(`daily-work-order-header-${group.key}`)]}>
      <HStack spacing={10} modifiers={[padding({ horizontal: 4, vertical: 4 }), frame({ maxWidth: Infinity, minHeight: 44, alignment: 'leading' }), contentShape(shapes.rectangle())]}>
        <Image systemName="doc.text" size={21} color={PlatformColor('systemBlue')} />
        <VStack alignment="leading" spacing={3} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
          <Text modifiers={[font({ textStyle: 'caption' }), secondary]}>{p('worker.daily.order')}{hasTitle ? ` • ${group.orderId}` : ''}</Text>
          <Text modifiers={[font({ textStyle: 'headline', weight: 'semibold' }), lineLimit(2)]}>{hasTitle ? group.title : group.orderId}</Text>
        </VStack>
        <Text modifiers={[font({ textStyle: 'caption', weight: 'semibold' }), secondary, fixedSize(), padding({ horizontal: 8, vertical: 5 }),
          background(PlatformColor('tertiarySystemFill')), cornerRadius(12)]}>{`${group.batches.length} ${p('worker.daily.wip')}`}</Text>
        <Image systemName={expanded ? 'chevron.up' : 'chevron.down'} size={13} modifiers={[secondary]} />
      </HStack>
    </Button>
    {expanded ? group.batches.map((batch, index) => <BatchCard key={`${batch.id}:${index}`} batch={batch} index={index} names={names} assigned={assigned} showWorker={showWorker} actions={actions} />) : null}
  </VStack>;
}

export function DailyWorkScreen({ session, onOpenDrawer, onBack }: Props) {
  const model = useDailyWork(session);
  const { day, setDay, batches, apparatusNames, groups, totals, error, refresh } = model;
  const actions = useDailyWorkActions(session, model);
  const { p, t } = useWorkerOrderText();
  const [dateDraft, setDateDraft] = useState<Date | null>(null);
  const now = new Date();
  const maxDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const workerName = String(session.profile.display_name || session.profile.legal_name || '').trim();

  return <View style={styles.flex}>
    <Stack.Screen options={{ headerShown: false }} />
    <Host style={styles.flex}>
      <NavigationStack>
        <Toolbar modifiers={[navigationTitle(p('worker.daily')), navigationBarTitleDisplayMode('large')]}>
          <List modifiers={[listStyle('insetGrouped'), scrollEdgeEffectStyle('soft', 'top'), refreshable(refresh)]}>
            <Section>
              <HStack><Text>{dailyWorkDayLabel(day)}</Text><Button label={p('worker.action.select')} systemImage="calendar" onPress={() => setDateDraft(dailyWorkDateDraft(day, now))} /></HStack>
              {workerName ? <Text modifiers={[secondary]}>{workerName}</Text> : null}
              <HStack spacing={12} modifiers={[padding({ vertical: 5 })]}>
                <Metric label={p('worker.daily.order')} value={totals.orders} />
                <Metric label="WIP" value={totals.wips} />
                <Metric label={p('worker.daily.used')} value={totals.used} />
              </HStack>
            </Section>
            {batches === null && !error ? <ProgressView /> : null}
            {error ? <Section><VStack alignment="leading" spacing={8}>
              <Text modifiers={[secondary]}>{p('worker.daily.load_failed')}</Text>
              <Button label={t('Qayta urinish')} onPress={() => { void refresh(); }} />
            </VStack></Section> : null}
            {batches !== null ? <Section title={p('worker.daily.produced_wips')}>
              {groups.length ? groups.map(group => <BatchGroup key={group.key} group={group} names={apparatusNames} assigned={session.assigned_apparatus} showWorker={session.profile.role === 'rezka_master'} actions={actions} />)
                : <Text modifiers={[secondary]}>{p('worker.daily.empty')}</Text>}
            </Section> : null}
          </List>
          <Toolbar.Content><ToolbarItem placement="topBarLeading">
            <Button systemImage={onOpenDrawer ? 'line.3.horizontal' : 'chevron.left'} label={onOpenDrawer ? 'Bo‘limlar' : 'Orqaga'}
              modifiers={[labelStyle('iconOnly')]} onPress={onOpenDrawer ?? onBack} />
          </ToolbarItem></Toolbar.Content>
        </Toolbar>
      </NavigationStack>
    </Host>
    <WorkerFormDialog visible={dateDraft !== null} title={p('worker.daily.choose_date.title')}
      cancelLabel={p('worker.action.cancel')} onCancel={() => setDateDraft(null)} confirmLabel={p('worker.action.select')}
      onConfirm={() => { if (dateDraft) setDay(dailyWorkDateDraft(dateDraft, now)); setDateDraft(null); }}>
      {dateDraft ? <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
        <DatePicker title={p('worker.daily.choose_date.title')} selection={dateDraft} displayedComponents={['date']}
          range={{ start: new Date(2020, 0, 1), end: maxDate }} onDateChange={date => setDateDraft(dailyWorkDateDraft(date, now))} modifiers={[datePickerStyle('graphical')]} />
      </Host> : null}
    </WorkerFormDialog>
    <DailyWorkDialogs session={session} model={model} actions={actions} />
  </View>;
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
