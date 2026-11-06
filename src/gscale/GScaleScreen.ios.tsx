import { Button, Host, List, ProgressView, RNHostView, Section, Text, TextField, Toggle, VStack, useNativeState } from '@expo/ui/swift-ui';
import { disabled, keyboardType, listStyle } from '@expo/ui/swift-ui/modifiers';
import { Image } from 'expo-image';
import { Redirect, Stack, router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import qrFactory from 'qrcode-generator';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, View } from 'react-native';
import { WorkerSecurityProvider } from '../components/WorkerSecurity';
import { useNativeSheet } from '../nativeSheet';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import type { ArchivePrintEntry, ArchiveSession } from './gscaleArchive';
import { gscaleDashboardSections, type GScaleRow } from './gscaleScreenModel';
import type { GScaleOperatorStore } from './gscaleOperatorState';
import type { GScaleModeArgs } from './gscaleRouteArgs';
import { useGScaleDevicePicker, useGScalePicker, useGScaleScreen, useGScaleSession, useGScaleText,
  type GScalePickerSpec } from './useGScaleScreen';

function Field({ row }: { row: Extract<GScaleRow, { kind: 'field' }> }) {
  const value = useNativeState(row.value), t = useGScaleText();
  useEffect(() => { if (value.get() !== row.value) value.set(row.value); }, [row.value, value]);
  return <TextField text={value} placeholder={t(row.label)} onTextChange={row.change} onFocusChange={row.focus}
    modifiers={[disabled(!!row.disabled), ...(row.decimal ? [keyboardType('decimal-pad')] : [])]} />;
}

function Row({ row }: { row: GScaleRow }) {
  const t = useGScaleText();
  if (row.kind === 'text') return <Text>{t(row.text)}</Text>;
  if (row.kind === 'field') return <Field row={row} />;
  if (row.kind === 'toggle') return <Toggle label={t(row.label)} isOn={row.value} onIsOnChange={row.change} modifiers={[disabled(!!row.disabled)]} />;
  return <Button modifiers={[disabled(!!row.disabled)]} onPress={row.press}><VStack alignment="leading">
    <Text>{t(row.label)}</Text>{row.detail ? <Text>{t(row.detail)}</Text> : null}</VStack></Button>;
}

function ChoiceSheet({ spec, close }: { spec: GScalePickerSpec; close(): void }) {
  const picker = useGScalePicker(spec), search = useNativeState(''), t = useGScaleText();
  return <Host style={{ minHeight: 420 }}><VStack><Text>{t(spec.title)}</Text><TextField text={search} placeholder={t(spec.hint)} onTextChange={picker.setQuery} />
    <List>{picker.loading && <ProgressView />}{!!picker.error && <Section><Text>{picker.error}</Text><Button label={t('Qayta urinish')} onPress={picker.retry} /></Section>}
      {!picker.loading && !picker.error && !picker.items.length && <Text>{t('Hech narsa topilmadi')}</Text>}
      {picker.items.map(item => <Button key={item.key} onPress={() => { item.select(); close(); }}><VStack alignment="leading"><Text>{item.title}</Text>
        {item.subtitle ? <Text>{item.subtitle}</Text> : null}</VStack></Button>)}
      {picker.more && <Button label={t('Yana yuklash')} modifiers={[disabled(picker.loading)]} onPress={picker.loadMore} />}</List>
    <Button label={t('Bekor qilish')} role="cancel" onPress={close} /></VStack></Host>;
}

function DeviceSheet({ operator, close }: { operator: GScaleOperatorStore; close(): void }) {
  const picker = useGScaleDevicePicker(operator, close), address = useNativeState(picker.address), t = useGScaleText();
  return <Host style={{ minHeight: 430 }}><VStack><Text>{t('Qurilma tanlash')}</Text><List>
    {picker.device.connection == null ? <Section>
      <Button label={t('Wi-Fi qurilma')} onPress={() => picker.choose('wifi')} />
      <Button label={t('Bluetooth printer')} onPress={() => picker.choose('bluetooth')} />
      <Button label={t('USB printer')} onPress={() => picker.choose('usb')} />
    </Section> : <Section><Button label={t('Orqaga')} onPress={() => picker.choose(null)} /></Section>}
    {picker.device.connection === 'wifi' && <Section title="Wi-Fi">
      <TextField text={address} placeholder={t('Server manzili')} onTextChange={picker.setAddress} />
      <Button label={t('Wi-Fi manzilini qo‘shish')} modifiers={[disabled(picker.device.checkingAddress)]} onPress={() => void picker.checkAddress()} />
      {!!picker.device.addressError && <Text>{picker.device.addressError}</Text>}
      {picker.device.scanning && <ProgressView />}
      {!picker.device.scanning && !picker.device.scanResult?.servers.length && <Text>{t('Qurilma topilmadi')}</Text>}
      {picker.device.scanResult?.servers.map(server => <Button key={server.endpoint.baseUrl} label={`${server.handshake.serverName} · ${server.endpoint.baseUrl}`}
        onPress={() => void picker.selectServer(server)} />)}
      <Button label={t('Yangilash')} modifiers={[disabled(picker.device.scanning)]} onPress={picker.scan} />
    </Section>}
    {picker.device.connection === 'bluetooth' && <Section title="Bluetooth">{picker.scanning && <ProgressView />}
      {!picker.scanning && !picker.printers.length && <Text>{t('Printer topilmadi')}</Text>}
      {picker.printers.map(printer => <Button key={printer.address} label={`${printer.displayName} · ${printer.address}`}
        onPress={() => void picker.selectBluetooth(printer)} />)}
      <Button label={t('Yangilash')} modifiers={[disabled(picker.scanning)]} onPress={picker.rescanBluetooth} /></Section>}
    {picker.device.connection === 'usb' && <Section title="USB">{picker.scanning && <ProgressView />}
      <Button label={t('USB printerni aniqlash')} modifiers={[disabled(picker.scanning)]} onPress={() => void picker.selectUsb()} /></Section>}
    {!!picker.error && <Text>{picker.error}</Text>}</List><Button label={t('Bekor qilish')} role="cancel" onPress={close} /></VStack></Host>;
}

function ArchiveSheet({ batch, operator, close }: { batch: ArchiveSession; operator: GScaleOperatorStore; close(): void }) {
  const [entry, setEntry] = useState<ArchivePrintEntry | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const t = useGScaleText();
  const qr = useMemo(() => {
    if (!entry?.epc) return '';
    try { const value = qrFactory(0, 'M'); value.addData(entry.epc); value.make(); return value.createDataURL(5, 20); } catch { return ''; }
  }, [entry]);
  const reprint = async () => {
    if (!entry || busy) return;
    setBusy(true); setMessage('');
    try { setMessage(await operator.reprintArchiveReceipt(entry) ?? 'Mavjud QR qayta chop etildi'); }
    catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  return <Host style={{ minHeight: 420 }}><VStack><Text>{entry ? t('Chop etilgan QR') : batch.item_name || batch.item_code}</Text><List>
    {entry ? <Section><Text>{entry.epc}</Text><Text>{`B ${entry.gross_qty} / N ${entry.net_qty} ${entry.unit} · ${batch.warehouse}`}</Text>
      {!!qr && <RNHostView matchContents><Image source={{ uri: qr }} style={{ width: 200, height: 200, backgroundColor: 'white' }}
        contentFit="contain" accessibilityLabel={t('Chop etilgan QR')} /></RNHostView>}
      {!!message && <Text>{t(message)}</Text>}<Button label={t('Qayta chop etish')} modifiers={[disabled(busy)]} onPress={() => void reprint()} />
      <Button label={t('Orqaga')} onPress={() => { setEntry(null); setMessage(''); }} /></Section>
      : <Section>{batch.prints.map((value, index) => <Button key={`${value.epc}:${index}`} label={`${value.epc || '—'} · ${value.net_qty} ${value.unit}`}
        onPress={() => setEntry(value)} />)}{!batch.prints.length && <Text>{t('Chop etilgan QR yo‘q')}</Text>}</Section>}
  </List><Button label={t('Yopish')} onPress={close} /></VStack></Host>;
}

function Dashboard({ session, args, signOut }: { session: NonNullable<ReturnType<typeof useGScaleSession>['session']>; args: GScaleModeArgs; signOut(): void }) {
  const screen = useGScaleScreen(session, args), sheet = useNativeSheet(), t = useGScaleText();
  const [section, setSection] = useState<'control' | 'history' | 'server'>('control');
  const pick = (spec: GScalePickerSpec) => sheet.open(<ChoiceSheet spec={spec} close={sheet.close} />);
  const chooseApparatus = (options: Record<string, string>) => new Promise<string | null>(resolve => {
    const spec: GScalePickerSpec = { title: 'Apparat tanlang', hint: 'Qidirish', pageSize: 50,
      load: async query => Object.entries(options).filter(([key, value]) => `${key} ${value}`.toLowerCase().includes(query.toLowerCase()))
        .map(([key, value]) => ({ key, title: value, select: () => resolve(key) })) };
    sheet.open(<ChoiceSheet spec={spec} close={sheet.close} />, { onDismiss: () => resolve(null) });
  });
  const sections = gscaleDashboardSections(screen, section, {
    pick, chooseApparatus, devices: () => sheet.open(<DeviceSheet operator={screen.operator} close={sheet.close} />),
    archive: batch => sheet.open(<ArchiveSheet batch={batch} operator={screen.operator} close={sheet.close} />),
    confirmArchivePrint: batch => Alert.alert(t('Partiya QR chop etish'), t('Shu partiya uchun QR chop etamizmi?'), [
      { text: t('Bekor qilish'), style: 'cancel' }, { text: t('Chop etish'), onPress: () => void screen.operator.printArchive(batch) },
    ]),
  });
  const exit = () => Alert.alert(t('Chiqish'), t('Hisobdan chiqasizmi?'), [{ text: t('Bekor qilish'), style: 'cancel' },
    { text: t('Chiqish'), onPress: signOut }]);
  return <><Stack.Screen options={{ headerShown: true, title: t(screen.controlOnly ? 'Homashyo kirimi' : 'Tarozilar rejimi'),
    ...(!router.canGoBack() ? { headerLeft: () => <Pressable accessibilityRole="button" accessibilityLabel={t('Orqaga')} onPress={exit}>
      <SymbolView name="chevron.left" size={20} /></Pressable> } : {}) }} />
    <Host style={{ flex: 1 }}><List modifiers={[listStyle('insetGrouped')]}><Section>
      <Button label={t(screen.controlOnly ? 'Print' : 'Boshqaruv')} onPress={() => setSection('control')} />
      <Button label={t(screen.controlOnly ? 'Print tarixi' : 'Arxiv')} onPress={() => { setSection('history'); void screen.operator.refreshArchive(); }} />
      {!screen.controlOnly && <Button label={t('Server')} onPress={() => setSection('server')} />}</Section>
      {sections.map((group, index) => <Section key={`${section}:${index}`} title={group.title ? t(group.title) : undefined}>
        {group.rows.map((row, rowIndex) => <Row key={`${row.kind}:${row.kind === 'text' ? rowIndex : row.label}`} row={row} />)}
      </Section>)}</List></Host></>;
}

// @v2 GScaleModeScreen
export function GScaleScreen({ args }: { args: GScaleModeArgs }) {
  const { session, signOut } = useGScaleSession();
  if (Platform.OS !== 'ios' || session === null || (session && !canOpenRoute(session, appRoutes.gscaleMode))) return <Redirect href="/" />;
  if (!session) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  return <WorkerSecurityProvider key={session.imageCacheScope} session={session} onLogout={signOut}>
    <Dashboard session={session} args={args} signOut={signOut} />
  </WorkerSecurityProvider>;
}
