import { Button, Column, Host, Icon, IconButton, OutlinedButton, OutlinedTextField, Row, Shape, Switch, Text, TextButton,
  useMaterialColors, useNativeState } from '@expo/ui/jetpack-compose';
import { defaultMinSize, fillMaxWidth, semantics, testID, weight } from '@expo/ui/jetpack-compose/modifiers';
import { router, type Href } from 'expo-router';
import { useEffect, useMemo, type ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text as NativeText, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureDetector, useNativeGesture, type PanGesture } from 'react-native-gesture-handler';
import type { Session } from '../auth';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { PreparationDock } from '../preparation/PreparationUI.android';
import { RoleHeaderButton } from '../shared/navigation/RoleHeaderButton';
import { OrdersWorkspace } from '../shared/orders/OrdersWorkspace';
import { gscaleReceiptGroups } from './gscaleReceiptLayout';
import type { GScaleRow, GScaleSection } from './gscaleScreenModel';
import { useGScaleText } from './useGScaleScreen';

type Action = Extract<GScaleRow, { kind: 'action' }>;
type Field = Extract<GScaleRow, { kind: 'field' }>;
const icons = {
  devices: require('../../assets/icons/gscale/add_link.xml'), connected: require('../../assets/icons/gscale/check_circle.xml'),
  expand: require('../../assets/icons/gscale/expand_more.xml'), warehouse: require('../../assets/icons/gscale/warehouse.xml'),
  search: require('../../assets/icons/gscale/search.xml'), save: require('../../assets/icons/gscale/save.xml'),
  start: require('../../assets/icons/gscale/play_arrow.xml'), print: require('../../assets/icons/gscale/print.xml'),
  stop: require('../../assets/icons/gscale/stop_circle.xml'), edit: require('../../assets/icons/gscale/edit.xml'),
  scale: require('../../assets/icons/gscale/scale.xml'),
};
const rounded = Shape.RoundedCorner({ cornerRadii: { topStart: 28, topEnd: 28, bottomStart: 28, bottomEnd: 28 } });
const actionIcons: Record<string, number> = { 'gscale-save': icons.save, 'gscale-start': icons.start,
  'gscale-print': icons.print, 'gscale-stop': icons.stop, 'gscale-context-edit': icons.edit };

function ReceiptLabel({ text, title = false }: { text: string; title?: boolean }) {
  const colors = useMaterialColors(), t = useGScaleText();
  const scale = text.startsWith('Joriy kg:');
  return <Host matchContents={{ vertical: true }} style={styles.full}>
    <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth()]}>
      {scale ? <Icon source={icons.scale} size={24} tint={colors.primary} /> : null}
      <Text color={title || scale ? colors.onSurface : colors.onSurfaceVariant} style={{ typography: title || scale ? 'titleMedium' : 'bodyMedium' }}
        modifiers={[weight(1)]}>{t(text)}</Text>
    </Row>
  </Host>;
}

export function ReceiptAction({ row, grow = false }: { row: Action; grow?: boolean }) {
  const colors = useMaterialColors(), t = useGScaleText();
  const primary = ['gscale-save', 'gscale-start', 'gscale-print', 'gscale-stop', 'gscale-receive'].includes(row.id ?? '');
  const Component = primary ? Button : TextButton;
  return <Component enabled={!row.disabled} onClick={row.press}
    colors={row.id === 'gscale-stop' ? { containerColor: colors.error, contentColor: colors.onError } : undefined}
    modifiers={[grow ? weight(1) : fillMaxWidth(), defaultMinSize({ minHeight: primary ? 60 : 48 }), ...(row.id ? [testID(row.id)] : [])]}>
    <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}>
      {row.id && actionIcons[row.id] ? <Icon source={actionIcons[row.id]} size={22} /> : null}
      <Column><Text style={{ typography: primary ? 'titleMedium' : 'labelLarge', fontSize: primary ? 18 : 14 }}>{t(row.label)}</Text>
        {row.detail ? <Text style={{ typography: 'bodySmall' }}>{t(row.detail)}</Text> : null}</Column>
    </Row>
  </Component>;
}

export function ReceiptPicker({ row }: { row: Action }) {
  const colors = useMaterialColors(), t = useGScaleText();
  const label = row.id === 'gscale-order' ? 'Order' : row.label;
  return <Host matchContents={{ vertical: true }} style={styles.full}>
    <OutlinedButton enabled={!row.disabled} onClick={row.press} shape={rounded}
      colors={{ containerColor: colors.surface, contentColor: colors.onSurface }} contentPadding={{ start: 16, end: 16, top: 10, bottom: 10 }}
      modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 64 }), testID(row.id!)]}>
      <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth()]}>
        {row.id !== 'gscale-order' ? <Icon source={row.id === 'gscale-warehouse' ? icons.warehouse : icons.search} size={24} tint={colors.onSurfaceVariant} /> : null}
        <Column modifiers={[weight(1)]}>
          <Text color={colors.onSurfaceVariant} style={{ typography: 'labelSmall' }}>{t(label)}</Text>
          <Text maxLines={2} style={{ typography: 'bodyLarge' }}>{t(row.detail || 'Tanlash uchun bosing')}</Text>
        </Column>
        <Icon source={icons.expand} size={24} tint={colors.onSurfaceVariant} />
      </Row>
    </OutlinedButton>
  </Host>;
}

export function ReceiptField({ row, grow = false }: { row: Field; grow?: boolean }) {
  const value = useNativeState(row.value), colors = useMaterialColors(), t = useGScaleText();
  useEffect(() => { if (value.get() !== row.value) value.set(row.value); }, [row.value, value]);
  const suffix = row.key === 'width_text' ? 'mm' : row.key === 'length_text' ? 'm'
    : row.key === 'manual_duplicate_text' ? 'ta' : ['babina_text', 'manual_qty_text'].includes(row.key ?? '') ? 'kg' : undefined;
  return <OutlinedTextField value={value} enabled={!row.disabled} singleLine shape={rounded}
    colors={{ focusedContainerColor: colors.surface, unfocusedContainerColor: colors.surface }}
    keyboardOptions={{ keyboardType: row.key === 'manual_duplicate_text' ? 'number' : 'decimal' }}
    onValueChange={row.change} onFocusChanged={row.focus}
    modifiers={[grow ? weight(1) : fillMaxWidth(), defaultMinSize({ minHeight: 56 }), testID(`gscale-${row.key}`)]}>
    <OutlinedTextField.Label><Text>{t(row.label)}</Text></OutlinedTextField.Label>
    {suffix ? <OutlinedTextField.Suffix><Text>{suffix}</Text></OutlinedTextField.Suffix> : null}
  </OutlinedTextField>;
}

function ReceiptToggle({ row }: { row: Extract<GScaleRow, { kind: 'toggle' }> }) {
  const colors = useMaterialColors(), t = useGScaleText(), babina = row.label === 'Babina';
  return <Host matchContents={{ vertical: true }} style={styles.full}>
    <Row verticalAlignment="center" modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 56 })]}>
      <Column modifiers={[weight(1)]}>
        <Text color={colors.onSurface} style={{ typography: 'titleMedium' }}>{t(babina ? 'Babina' : 'Miqdor (kg)')}</Text>
        <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>{t(babina ? row.value ? 'Bor' : 'Yo‘q' : row.label)}</Text>
      </Column>
      <Switch value={row.value} enabled={!row.disabled} onCheckedChange={row.change}
        modifiers={[semantics({ contentDescription: t(babina ? 'Babina' : 'Miqdor (kg)') })]} />
    </Row>
  </Host>;
}

export function ReceiptRows({ rows }: { rows: readonly GScaleRow[] }) {
  const colors = useMaterialColors(), t = useGScaleText(), { width, fontScale } = useWindowDimensions();
  const stacked = width < 360 || fontScale > 1.2;
  return <>{gscaleReceiptGroups(rows).map((group, index) => {
    if (group.kind === 'summary') return <View key="summary" style={[styles.summary, { backgroundColor: colors.surface }]}>
      <View style={{ flex: 1, gap: 4 }}><ReceiptRows rows={group.rows.filter(row => row.kind !== 'action')} /></View>
      <Host style={{ width: 48, height: 48 }}><IconButton enabled={!(group.rows.at(-1) as Action).disabled}
        onClick={(group.rows.at(-1) as Action).press} modifiers={[testID('gscale-context-edit'), semantics({ contentDescription: t('Batch ma’lumotini tahrirlash') })]}>
        <Icon source={icons.edit} size={22} tint={colors.onSurfaceVariant} />
      </IconButton></Host>
    </View>;
    if (group.kind === 'fields' || group.kind === 'actions') return <Host key={`${group.kind}:${group.rows[0].kind === 'field' ? group.rows[0].key : index}`}
      matchContents={{ vertical: true }} style={styles.full}>
      {stacked ? <Column verticalArrangement={{ spacedBy: 10 }} modifiers={[fillMaxWidth()]}>{group.rows.map((row, i) => row.kind === 'field'
        ? <ReceiptField key={i} row={row} /> : <ReceiptAction key={i} row={row as Action} />)}</Column>
        : <Row horizontalArrangement={{ spacedBy: 10 }} verticalAlignment="center" modifiers={[fillMaxWidth()]}>{group.rows.map((row, i) => row.kind === 'field'
          ? <ReceiptField key={i} row={row} grow /> : <ReceiptAction key={i} row={row as Action} grow />)}</Row>}
    </Host>;
    const row = group.rows[0], key = row.kind === 'field' ? row.key : row.kind === 'action' ? row.id ?? row.label : `${row.kind}:${index}`;
    if (row.kind === 'field') return <Host key={key} matchContents={{ vertical: true }} style={styles.full}><ReceiptField row={row} /></Host>;
    if (row.kind === 'toggle') return <ReceiptToggle key={key} row={row} />;
    if (row.kind === 'text') return <ReceiptLabel key={key} text={row.text} />;
    if (['gscale-order', 'gscale-warehouse', 'gscale-item'].includes(row.id ?? '')) return <ReceiptPicker key={key} row={row} />;
    return <Host key={key} matchContents={{ vertical: true }} style={styles.full}><ReceiptAction row={row} /></Host>;
  })}</>;
}

function ReceiptHistory({ sections }: { sections: GScaleSection[] }) {
  const colors = useMaterialColors();
  return <>{sections.flatMap(section => section.rows).map((row, index) => row.kind === 'action' && row.detail
    ? <WorkerQueueCard key={index} backgroundColor={colors.surface} onPress={row.press}>
      <View style={styles.historyText}><NativeText style={[styles.historyTitle, { color: colors.onSurface }]}>{row.label}</NativeText>
        <NativeText style={{ color: colors.onSurfaceVariant }}>{row.detail}</NativeText></View>
    </WorkerQueueCard> : <ReceiptRows key={index} rows={[row]} />)}</>;
}

function ReceiptScroll({ pagerGesture, refreshing, onRefresh, children }: {
  pagerGesture?: PanGesture; refreshing: boolean; onRefresh?: () => void; children: ReactNode;
}) {
  const gesture = useNativeGesture(useMemo(() => ({ requireToFail: pagerGesture }), [pagerGesture]));
  return <GestureDetector gesture={gesture}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}
    refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}>
    {children}
  </ScrollView></GestureDetector>;
}

type Props = { session: Session; title: string; section: 'control' | 'history'; onSelect(id: 'control' | 'history'): void;
  control: GScaleSection[]; history: GScaleSection[]; connected: boolean; attention: boolean; refreshing: boolean;
  onRefresh(): void; onDevices(): void; onBack(): void };

export function GScaleReceipt({ session, title, section, onSelect, control, history, connected, attention, refreshing, onRefresh, onDevices, onBack }: Props) {
  const colors = useMaterialColors(), insets = useSafeAreaInsets(), t = useGScaleText();
  const order = control.find(group => group.title === 'Order'), device = control[0]?.rows[0];
  const status = control[0]?.rows.slice(1) ?? [];
  return <View style={[styles.root, { backgroundColor: colors.surfaceContainerLow, paddingTop: insets.top }]}>
    <View style={styles.header}>
      <RoleHeaderButton icon="back" label={t('Orqaga')} tintColor={colors.onSurfaceVariant} onPress={onBack} />
      <Host matchContents={{ vertical: true }} style={{ flex: 1 }}><Text color={colors.onSurface} style={{ typography: 'titleLarge', fontWeight: '600' }}>{title}</Text></Host>
      <Host style={{ width: 48, height: 48 }}><IconButton onClick={onDevices} modifiers={[
        testID('gscale-device'), semantics({ contentDescription: t('Printer yoki tarozi tanlash') }),
      ]}><Icon source={icons.devices} size={26} tint={attention || !connected ? colors.error : colors.primary} /></IconButton></Host>
      <RoleHeaderButton icon="profile" label={t('Profil')} tintColor={colors.onSurfaceVariant}
        onPress={() => router.navigate('/android-preparation/profile' as Href)} />
    </View>
    <OrdersWorkspace session={session} tabs={[{ id: 'control', name: t('Print') }, { id: 'history', name: t('Print tarixi') }]}
      selected={section} onSelect={id => { if (id === 'control' || id === 'history') onSelect(id); }}>
      {(id, pagerGesture) => <ReceiptScroll pagerGesture={pagerGesture} refreshing={refreshing} onRefresh={id === 'history' ? onRefresh : undefined}>
        {id === 'control' ? <>
          {order ? <ReceiptRows rows={order.rows} /> : null}
          {connected && device?.kind === 'action' ? <View style={styles.deviceStatus}>
            <Host style={{ width: 18, height: 18 }}><Icon source={icons.connected} size={18} tint={colors.primary} /></Host>
            <NativeText style={{ flex: 1, color: colors.onSurfaceVariant }}>{device.label}</NativeText>
            <Pressable accessibilityRole="button" onPress={device.press}><NativeText style={{ color: colors.primary }}>{t('Almashtirish')}</NativeText></Pressable>
          </View> : null}
          {device?.kind === 'action' && device.detail ? <ReceiptLabel text={device.detail} /> : null}
          <ReceiptRows rows={status} />
          {control.slice(1).filter(group => group !== order).map((group, index) => <View key={index} style={styles.group}>
            {group.title ? <ReceiptLabel title text={group.title} /> : null}<ReceiptRows rows={group.rows} />
          </View>)}
        </> : <ReceiptHistory sections={history} />}
      </ReceiptScroll>}
    </OrdersWorkspace>
    <PreparationDock />
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 }, full: { width: '100%' }, header: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 64, paddingHorizontal: 10 },
  content: { paddingTop: 60, paddingHorizontal: 14, paddingBottom: 24, gap: 10, flexGrow: 1 },
  group: { gap: 10 }, summary: { padding: 12, borderRadius: 20, gap: 8, flexDirection: 'row', alignItems: 'center' },
  deviceStatus: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 4 },
  historyText: { flex: 1, padding: 10, gap: 4 }, historyTitle: { fontSize: 16, fontWeight: '500' },
});
