import { Button, Column, Host, Icon, IconButton, OutlinedButton, OutlinedTextField, RNHostView, Row, Shape, Switch, Text, TextButton,
  useMaterialColors, useNativeState } from '@expo/ui/jetpack-compose';
import { background, cornerRadius, defaultMinSize, fillMaxWidth, padding, semantics, testID, weight } from '@expo/ui/jetpack-compose/modifiers';
import { router, type Href } from 'expo-router';
import { useEffect, useMemo, type ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text as NativeText, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureDetector, GestureHandlerRootView, useNativeGesture, type PanGesture } from 'react-native-gesture-handler';
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
  return <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth()]}>
      {scale ? <Icon source={icons.scale} size={24} tint={colors.primary} /> : null}
      <Text color={title || scale ? colors.onSurface : colors.onSurfaceVariant} style={{ typography: title || scale ? 'titleMedium' : 'bodyMedium' }}
        modifiers={[weight(1)]}>{t(text)}</Text>
    </Row>;
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
  return <OutlinedButton enabled={!row.disabled} onClick={row.press} shape={rounded}
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
    </OutlinedButton>;
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
  return <Row verticalAlignment="center" modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 56 })]}>
      <Column modifiers={[weight(1)]}>
        <Text color={colors.onSurface} style={{ typography: 'titleMedium' }}>{t(babina ? 'Babina' : 'Miqdor (kg)')}</Text>
        <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>{t(babina ? row.value ? 'Bor' : 'Yo‘q' : row.label)}</Text>
      </Column>
      <Switch value={row.value} enabled={!row.disabled} onCheckedChange={row.change}
        modifiers={[semantics({ contentDescription: t(babina ? 'Babina' : 'Miqdor (kg)') })]} />
    </Row>;
}

export function ReceiptRows({ rows }: { rows: readonly GScaleRow[] }) {
  const { width, fontScale } = useWindowDimensions();
  return <Host matchContents={{ vertical: true }} style={styles.full}>
    <Column verticalArrangement={{ spacedBy: 10 }} modifiers={[fillMaxWidth()]}>
      <ReceiptRowGroups rows={rows} stacked={width < 360 || fontScale > 1.2} />
    </Column>
  </Host>;
}

function ReceiptRowGroups({ rows, stacked }: { rows: readonly GScaleRow[]; stacked: boolean }) {
  const colors = useMaterialColors(), t = useGScaleText();
  return <>{gscaleReceiptGroups(rows).map((group, index) => {
    if (group.kind === 'summary') return <Row key="summary" verticalAlignment="top" horizontalArrangement={{ spacedBy: 8 }}
      modifiers={[fillMaxWidth(), cornerRadius(20), background(colors.surface), padding(12, 12, 12, 12)]}>
      <Column verticalArrangement={{ spacedBy: 4 }} modifiers={[weight(1)]}>
        <ReceiptRowGroups rows={group.rows.filter(row => row.kind !== 'action')} stacked={stacked} />
      </Column>
      <IconButton enabled={!(group.rows.at(-1) as Action).disabled}
        onClick={(group.rows.at(-1) as Action).press} modifiers={[defaultMinSize({ minWidth: 48, minHeight: 48 }), testID('gscale-context-edit'), semantics({ contentDescription: t('Batch ma’lumotini tahrirlash') })]}>
        <Icon source={icons.edit} size={22} tint={colors.onSurfaceVariant} />
      </IconButton>
    </Row>;
    if (group.kind === 'fields' || group.kind === 'actions') return <Column key={`${group.kind}:${group.rows[0].kind === 'field' ? group.rows[0].key : index}`} modifiers={[fillMaxWidth()]}>
      {stacked ? <Column verticalArrangement={{ spacedBy: 10 }} modifiers={[fillMaxWidth()]}>{group.rows.map((row, i) => row.kind === 'field'
        ? <ReceiptField key={i} row={row} /> : <ReceiptAction key={i} row={row as Action} />)}</Column>
        : <Row horizontalArrangement={{ spacedBy: 10 }} verticalAlignment="center" modifiers={[fillMaxWidth()]}>{group.rows.map((row, i) => row.kind === 'field'
          ? <ReceiptField key={i} row={row} grow /> : <ReceiptAction key={i} row={row as Action} grow />)}</Row>}
    </Column>;
    const row = group.rows[0], key = row.kind === 'field' ? row.key : row.kind === 'action' ? row.id ?? row.label : `${row.kind}:${index}`;
    if (row.kind === 'field') return <ReceiptField key={key} row={row} />;
    if (row.kind === 'toggle') return <ReceiptToggle key={key} row={row} />;
    if (row.kind === 'text') return <ReceiptLabel key={key} text={row.text} />;
    if (['gscale-order', 'gscale-warehouse', 'gscale-item'].includes(row.id ?? '')) return <ReceiptPicker key={key} row={row} />;
    return <ReceiptAction key={key} row={row} />;
  })}</>;
}

function ReceiptControl({ control, connected }: { control: GScaleSection[]; connected: boolean }) {
  const colors = useMaterialColors(), t = useGScaleText(), { width, fontScale } = useWindowDimensions();
  const stacked = width < 360 || fontScale > 1.2;
  const order = control.find(group => group.title === 'Order'), device = control[0]?.rows[0];
  const status = control[0]?.rows.slice(1) ?? [];
  return <Column verticalArrangement={{ spacedBy: 10 }} modifiers={[fillMaxWidth()]}>
    {order ? <ReceiptRowGroups rows={order.rows} stacked={stacked} /> : null}
    {connected && device?.kind === 'action' ? <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 12 }}
      modifiers={[fillMaxWidth(), padding(0, 4, 0, 4)]}>
      <Icon source={icons.connected} size={18} tint={colors.primary} />
      <Text color={colors.onSurfaceVariant} style={{ typography: 'bodyMedium' }} modifiers={[weight(1)]}>{device.label}</Text>
      <RNHostView matchContents><Pressable accessibilityRole="button" onPress={device.press}>
        <NativeText style={{ color: colors.primary }}>{t('Almashtirish')}</NativeText>
      </Pressable></RNHostView>
    </Row> : null}
    {device?.kind === 'action' && device.detail ? <ReceiptLabel text={device.detail} /> : null}
    <ReceiptRowGroups rows={status} stacked={stacked} />
    {control.slice(1).filter(group => group !== order).map((group, index) => <Column key={index} verticalArrangement={{ spacedBy: 10 }} modifiers={[fillMaxWidth()]}>
      {group.title ? <ReceiptLabel title text={group.title} /> : null}<ReceiptRowGroups rows={group.rows} stacked={stacked} />
    </Column>)}
  </Column>;
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
  return <GestureHandlerRootView style={[styles.root, { backgroundColor: colors.surfaceContainerLow, paddingTop: insets.top }]}>
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
        {id === 'control' ? <Host matchContents={{ vertical: true }} style={styles.full}>
          <ReceiptControl control={control} connected={connected} />
        </Host> : <ReceiptHistory sections={history} />}
      </ReceiptScroll>}
    </OrdersWorkspace>
    <PreparationDock />
  </GestureHandlerRootView>;
}

const styles = StyleSheet.create({
  root: { flex: 1 }, full: { width: '100%' }, header: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 64, paddingHorizontal: 10 },
  content: { paddingTop: 60, paddingHorizontal: 14, paddingBottom: 24, gap: 10, flexGrow: 1 },
  historyText: { flex: 1, padding: 10, gap: 4 }, historyTitle: { fontSize: 16, fontWeight: '500' },
});
