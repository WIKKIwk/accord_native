import { Button, DatePicker, DisclosureGroup, Host, HStack, Image, List, NavigationStack, ProgressView, Section, Text, Toolbar, ToolbarItem, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, contentShape, datePickerStyle, font, foregroundStyle, frame, labelStyle, lineLimit, listStyle, navigationBarTitleDisplayMode, navigationTitle, onLongPressGesture, padding, refreshable, scrollEdgeEffectStyle, shapes } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { useContext, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Session } from '../auth';
import { dailyWorkDate, dailyWorkLocation, dailyWorkQuantity, dailyWorkStatus, type DailyWorkBatch, type DailyWorkGroup } from '../dailyWork';
import { useDailyWork } from './useDailyWork';
import { WorkerOrderSheet } from './WorkerOrderSheet';
import { WorkerSheetCloseContext } from './workerSheetContext';
import { useDailyWorkActions } from './useDailyWorkActions';
import { DailyWorkDialogs } from './DailyWorkDialogs';
import { useWorkerOrderText } from './useWorkerOrderText';

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

function BatchGroup({ group, onOpen, actions }: { group: DailyWorkGroup; onOpen: (batch: DailyWorkBatch) => void; actions: ReturnType<typeof useDailyWorkActions> }) {
  const [expanded, setExpanded] = useState(false);
  const held = useMemo(() => createLongPressGate(), []);
  useEffect(() => { if (!actions.qrBatch && !actions.alert) held.reset(); }, [actions.qrBatch, actions.alert, held]);
  const { p } = useWorkerOrderText();
  return <DisclosureGroup isExpanded={expanded} onIsExpandedChange={setExpanded}>
    <DisclosureGroup.Label>
      <HStack spacing={12}>
        <Image systemName="doc.text" size={21} />
        <VStack alignment="leading" spacing={3} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
          <Text modifiers={[font({ textStyle: 'body', weight: 'medium' }), lineLimit(2)]}>{group.title || group.orderId || 'Buyurtma'}</Text>
          {group.title && group.orderId && group.title !== group.orderId ? <Text modifiers={[font({ textStyle: 'caption' }), secondary, lineLimit(1)]}>{group.orderId}</Text> : null}
        </VStack>
        <Text modifiers={[font({ textStyle: 'subheadline' }), secondary]}>{`${group.batches.length} WIP`}</Text>
      </HStack>
    </DisclosureGroup.Label>
    {expanded ? group.batches.map((batch, index) => <HStack key={`${batch.id}:${index}`} spacing={8}>
      <Button onPress={() => { if (!held.take(batch.id)) onOpen(batch); }} modifiers={[buttonStyle('plain'), frame({ maxWidth: Infinity }), onLongPressGesture(() => { held.mark(batch.id); actions.showQr(batch); }, 0.5)]}>
      <HStack spacing={10} modifiers={[frame({ maxWidth: Infinity }), padding({ vertical: 7 }), contentShape(shapes.rectangle())]}>
        <VStack alignment="leading" spacing={3} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
          <Text modifiers={[font({ textStyle: 'body' }), lineLimit(1)]}>{`WIP ${index + 1}`}</Text>
          <Text modifiers={[font({ textStyle: 'caption' }), secondary, lineLimit(1)]}>{dailyWorkStatus(batch)}</Text>
        </VStack>
        <Text modifiers={[font({ textStyle: 'subheadline' }), secondary]}>{dailyWorkQuantity(batch)}</Text>
        <Image systemName="chevron.right" size={12} modifiers={[secondary]} />
      </HStack>
    </Button>
      {actions.canEdit(batch) ? <Button label={p('worker.daily.edit_wip')} systemImage="pencil" modifiers={[labelStyle('iconOnly'), buttonStyle('borderless')]}
        onPress={() => actions.edit(batch)} /> : null}
    </HStack>) : null}
  </DisclosureGroup>;
}

function BatchDetail({ batch, names, onClose }: { batch: DailyWorkBatch; names: Record<string, string>; onClose: () => void }) {
  const close = useContext(WorkerSheetCloseContext) ?? onClose;
  const rows: [string, string][] = [
    ['Holat', dailyWorkStatus(batch)],
    ['Miqdor', dailyWorkQuantity(batch)],
    ['Vazn', batch.weight == null ? '' : `${batch.weight} kg`],
    ['Bobina', batch.bobina == null ? '' : `${batch.bobina} kg`],
    ['Diametr', batch.diameter == null ? '' : `${batch.diameter} mm`],
    ['Boshlangan', dailyWorkDate(batch.started)],
    ['Yakunlangan', dailyWorkDate(batch.completed)],
    ['Aparat', dailyWorkLocation(batch.apparatus, names)],
    ['Joylashuv', dailyWorkLocation(batch.location, names)],
    ['Keyingi aparat', dailyWorkLocation(batch.nextApparatus, names)],
    ['Ishchi', batch.worker],
    ['QR', batch.qr],
    ['Izoh', batch.description],
  ].filter((row): row is [string, string] => !!row[1]);

  return <Host style={styles.flex}>
    <NavigationStack>
      <Toolbar modifiers={[navigationTitle('WIP ma’lumotlari'), navigationBarTitleDisplayMode('inline')]}>
        <List modifiers={[listStyle('insetGrouped')]}>
          <Section title={batch.title || 'WIP'}>
            {rows.map(([label, value]) => <VStack key={label} alignment="leading" spacing={4} modifiers={[padding({ vertical: 3 })]}>
              <Text modifiers={[font({ textStyle: 'caption' }), secondary]}>{label}</Text>
              <Text modifiers={[font({ textStyle: 'body' })]}>{value}</Text>
            </VStack>)}
          </Section>
        </List>
        <Toolbar.Content><ToolbarItem placement="topBarTrailing">
          <Button label="Yopish" onPress={close} />
        </ToolbarItem></Toolbar.Content>
      </Toolbar>
    </NavigationStack>
  </Host>;
}

export function DailyWorkScreen({ session, onOpenDrawer, onBack }: Props) {
  const model = useDailyWork(session);
  const { day, setDay, batches, apparatusNames, groups, totals, error, refresh } = model;
  const actions = useDailyWorkActions(session, model);
  const [selected, setSelected] = useState<DailyWorkBatch | null>(null);
  const now = new Date();
  const maxDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const workerName = String(session.profile.display_name || session.profile.legal_name || '').trim();

  return <View style={styles.flex}>
    <Stack.Screen options={{ headerShown: false }} />
    <Host style={styles.flex}>
      <NavigationStack>
        <Toolbar modifiers={[navigationTitle('Kunlik ish'), navigationBarTitleDisplayMode('large')]}>
          <List modifiers={[listStyle('insetGrouped'), scrollEdgeEffectStyle('soft', 'top'), refreshable(refresh)]}>
            <Section>
              <DatePicker title="Sana" selection={day} displayedComponents={['date']} range={{ start: new Date(2020, 0, 1), end: maxDate }}
                onDateChange={setDay} modifiers={[datePickerStyle('compact')]} />
              {workerName ? <Text modifiers={[secondary]}>{workerName}</Text> : null}
              <HStack spacing={12} modifiers={[padding({ vertical: 5 })]}>
                <Metric label="Buyurtma" value={totals.orders} />
                <Metric label="WIP" value={totals.wips} />
                <Metric label="Ishlatilgan" value={totals.used} />
              </HStack>
            </Section>
            {batches === null && !error ? <Section><HStack spacing={10}><ProgressView /><Text>Yuklanmoqda…</Text></HStack></Section> : null}
            {error ? <Section><VStack alignment="leading" spacing={8}>
              <Text modifiers={[secondary]}>{error}</Text>
              <Button label="Qayta urinish" onPress={() => { void refresh(); }} />
            </VStack></Section> : null}
            {batches !== null ? <Section title="Ishlab chiqarilgan WIP">
              {groups.length ? groups.map(group => <BatchGroup key={group.key} group={group} onOpen={setSelected} actions={actions} />)
                : <Text modifiers={[secondary]}>Bu kunda ishlar topilmadi.</Text>}
            </Section> : null}
            {batches && batches.length >= 200 ? <Section><Text modifiers={[font({ textStyle: 'caption' }), secondary]}>So‘nggi 200 ta yozuv ko‘rsatilmoqda.</Text></Section> : null}
          </List>
          <Toolbar.Content><ToolbarItem placement="topBarLeading">
            <Button systemImage={onOpenDrawer ? 'line.3.horizontal' : 'chevron.left'} label={onOpenDrawer ? 'Bo‘limlar' : 'Orqaga'}
              modifiers={[labelStyle('iconOnly')]} onPress={onOpenDrawer ?? onBack} />
          </ToolbarItem></Toolbar.Content>
        </Toolbar>
      </NavigationStack>
    </Host>
    {selected ? <WorkerOrderSheet dismissible onClose={() => setSelected(null)}>
      <BatchDetail batch={selected} names={apparatusNames} onClose={() => setSelected(null)} />
    </WorkerOrderSheet> : null}
    <DailyWorkDialogs session={session} model={model} actions={actions} />
  </View>;
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
