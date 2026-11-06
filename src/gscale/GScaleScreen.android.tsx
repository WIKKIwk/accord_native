import { Button, Column, Host, OutlinedTextField, Row, Switch, Text, useMaterialColors, useNativeState } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, testID } from '@expo/ui/jetpack-compose/modifiers';
import { Image } from 'expo-image';
import { Redirect, Stack, router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import qrFactory from 'qrcode-generator';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkerSecurityProvider } from '../components/WorkerSecurity';
import { useNativeSheet } from '../nativeSheet';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import type { ArchivePrintEntry, ArchiveSession } from './gscaleArchive';
import { gscaleDashboardSections, type GScaleRow } from './gscaleScreenModel';
import type { GScaleOperatorStore } from './gscaleOperatorState';
import type { GScaleModeArgs } from './gscaleRouteArgs';
import { useGScaleDevicePicker, useGScalePicker, useGScaleScreen, useGScaleSession, useGScaleText,
  type GScalePickerSpec } from './useGScaleScreen';

function Label({ children }: { children: string }) {
  const colors = useMaterialColors();
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Text color={colors.onSurface}>{children}</Text></Host>;
}
function Action({ label, detail, onPress, disabled: blocked, id }: {
  label: string; detail?: string; onPress(): void; disabled?: boolean; id?: string;
}) {
  const t = useGScaleText();
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Button enabled={!blocked} onClick={onPress}
    modifiers={[fillMaxWidth(), ...(id ? [testID(id)] : [])]}><Column><Text>{t(label)}</Text>{detail ? <Text>{t(detail)}</Text> : null}</Column></Button></Host>;
}
function Field({ row }: { row: Extract<GScaleRow, { kind: 'field' }> }) {
  const value = useNativeState(row.value), t = useGScaleText();
  useEffect(() => { if (value.get() !== row.value) value.set(row.value); }, [row.value, value]);
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><OutlinedTextField value={value} singleLine enabled={!row.disabled}
    keyboardOptions={{ keyboardType: row.decimal ? 'decimal' : 'text' }} onValueChange={row.change} onFocusChanged={row.focus} modifiers={[fillMaxWidth()]}>
    <OutlinedTextField.Label><Text>{t(row.label)}</Text></OutlinedTextField.Label></OutlinedTextField></Host>;
}
function DashboardRow({ row }: { row: GScaleRow }) {
  const t = useGScaleText();
  if (row.kind === 'text') return <Label>{t(row.text)}</Label>;
  if (row.kind === 'field') return <Field row={row} />;
  if (row.kind === 'toggle') return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Row>
    <Text>{t(row.label)}</Text><Switch value={row.value} enabled={!row.disabled} onCheckedChange={row.change} /></Row></Host>;
  return <Action label={row.label} detail={row.detail} disabled={row.disabled} onPress={row.press} id={row.id} />;
}

function ChoiceSheet({ spec, close }: { spec: GScalePickerSpec; close(): void }) {
  const picker = useGScalePicker(spec), search = useNativeState(''), t = useGScaleText();
  return <View style={{ minHeight: 400, padding: 16, gap: 10 }}><Label>{t(spec.title)}</Label>
    <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><OutlinedTextField value={search} singleLine onValueChange={picker.setQuery} modifiers={[fillMaxWidth()]}>
      <OutlinedTextField.Label><Text>{t(spec.hint)}</Text></OutlinedTextField.Label></OutlinedTextField></Host>
    <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
      {picker.loading && <ActivityIndicator />}{!!picker.error && <><Label>{picker.error}</Label><Action label="Qayta urinish" onPress={picker.retry} /></>}
      {!picker.loading && !picker.error && !picker.items.length && <Label>{t('Hech narsa topilmadi')}</Label>}
      {picker.items.map(item => <Action key={item.key} label={item.title} detail={item.subtitle} onPress={() => { item.select(); close(); }} />)}
      {picker.more && <Action label="Yana yuklash" disabled={picker.loading} onPress={picker.loadMore} />}</ScrollView>
    <Action label="Bekor qilish" onPress={close} /></View>;
}

function DeviceSheet({ operator, close }: { operator: GScaleOperatorStore; close(): void }) {
  const picker = useGScaleDevicePicker(operator, close), address = useNativeState(picker.address), t = useGScaleText();
  return <View style={{ minHeight: 400, padding: 16, gap: 10 }}><Label>{t('Qurilma tanlash')}</Label>
    <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
      {picker.device.connection == null ? <>
        <Action label="Wi-Fi qurilma" onPress={() => picker.choose('wifi')} /><Action label="Bluetooth printer" onPress={() => picker.choose('bluetooth')} />
        <Action label="USB printer" onPress={() => picker.choose('usb')} />
      </> : <Action label="Orqaga" onPress={() => picker.choose(null)} />}
      {picker.device.connection === 'wifi' && <>
        <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><OutlinedTextField value={address} singleLine onValueChange={picker.setAddress} modifiers={[fillMaxWidth()]}>
          <OutlinedTextField.Label><Text>{t('Server manzili')}</Text></OutlinedTextField.Label></OutlinedTextField></Host>
        <Action label="Wi-Fi manzilini qo‘shish" disabled={picker.device.checkingAddress} onPress={() => void picker.checkAddress()} />
        {!!picker.device.addressError && <Label>{picker.device.addressError}</Label>}
        {picker.device.scanning && <ActivityIndicator />}
        {!picker.device.scanning && !picker.device.scanResult?.servers.length && <Label>{t('Qurilma topilmadi')}</Label>}
        {picker.device.scanResult?.servers.map(server => <Action key={server.endpoint.baseUrl} label={server.handshake.serverName}
          detail={server.endpoint.baseUrl} onPress={() => void picker.selectServer(server)} />)}
        <Action label="Yangilash" disabled={picker.device.scanning} onPress={picker.scan} />
      </>}
      {picker.device.connection === 'bluetooth' && <>{picker.scanning && <ActivityIndicator />}
        {!picker.scanning && !picker.printers.length && <Label>{t('Printer topilmadi')}</Label>}
        {picker.printers.map(printer => <Action key={printer.address} label={printer.displayName} detail={printer.address}
          onPress={() => void picker.selectBluetooth(printer)} />)}
        <Action label="Yangilash" disabled={picker.scanning} onPress={picker.rescanBluetooth} /></>}
      {picker.device.connection === 'usb' && <>{picker.scanning && <ActivityIndicator />}
        <Action label="USB printerni aniqlash" disabled={picker.scanning} onPress={() => void picker.selectUsb()} /></>}
      {!!picker.error && <Label>{picker.error}</Label>}
    </ScrollView><Action label="Bekor qilish" onPress={close} /></View>;
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
  return <View style={{ minHeight: 400, padding: 16, gap: 10 }}><Label>{entry ? t('Chop etilgan QR') : batch.item_name || batch.item_code}</Label>
    <ScrollView style={{ maxHeight: 450 }} contentContainerStyle={{ gap: 8 }}>
      {entry ? <><Label>{entry.epc}</Label><Label>{`B ${entry.gross_qty} / N ${entry.net_qty} ${entry.unit} · ${batch.warehouse}`}</Label>
        {!!qr && <Image source={{ uri: qr }} style={{ width: 200, height: 200, backgroundColor: 'white', alignSelf: 'center' }}
          contentFit="contain" accessibilityLabel={t('Chop etilgan QR')} />}
        {!!message && <Label>{t(message)}</Label>}<Action label="Qayta chop etish" disabled={busy} onPress={() => void reprint()} />
        <Action label="Orqaga" onPress={() => { setEntry(null); setMessage(''); }} /></>
        : <>{batch.prints.map((value, index) => <Action key={`${value.epc}:${index}`} label={`${value.epc || '—'} · ${value.net_qty} ${value.unit}`}
          onPress={() => setEntry(value)} />)}{!batch.prints.length && <Label>{t('Chop etilgan QR yo‘q')}</Label>}</>}
    </ScrollView><Action label="Yopish" onPress={close} /></View>;
}

function Dashboard({ session, args, signOut }: { session: NonNullable<ReturnType<typeof useGScaleSession>['session']>; args: GScaleModeArgs; signOut(): void }) {
  const screen = useGScaleScreen(session, args), sheet = useNativeSheet(), t = useGScaleText(), insets = useSafeAreaInsets(), colors = useMaterialColors();
  const [section, setSection] = useState<'control' | 'history' | 'server'>('control');
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (router.canGoBack()) return false;
      Alert.alert(t('Chiqish'), t('Hisobdan chiqasizmi?'), [{ text: t('Bekor qilish'), style: 'cancel' },
        { text: t('Chiqish'), onPress: signOut }]);
      return true;
    });
    return () => subscription.remove();
  }, [signOut, t]);
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
      <SymbolView name={{ android: 'arrow_back' }} size={24} tintColor={colors.onSurface} /></Pressable> } : {}) }} />
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingBottom: insets.bottom }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 10 }}>
        <Action label={screen.controlOnly ? 'Print' : 'Boshqaruv'} onPress={() => setSection('control')} />
        <Action label={screen.controlOnly ? 'Print tarixi' : 'Arxiv'} onPress={() => { setSection('history'); void screen.operator.refreshArchive(); }} />
        {!screen.controlOnly && <Action label="Server" onPress={() => setSection('server')} />}
        {sections.map((group, index) => <View key={`${section}:${index}`} style={{ gap: 8 }}>
          {group.title ? <Label>{t(group.title)}</Label> : null}
          {group.rows.map((row, rowIndex) => <DashboardRow key={`${row.kind}:${row.kind === 'text' ? rowIndex : row.label}`} row={row} />)}
        </View>)}
      </ScrollView>
    </View></>;
}

// @v2 GScaleModeScreen
export function GScaleScreen({ args }: { args: GScaleModeArgs }) {
  const { session, signOut } = useGScaleSession();
  if (Platform.OS !== 'android' || session === null || (session && !canOpenRoute(session, appRoutes.gscaleMode))) return <Redirect href="/" />;
  if (!session) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  return <WorkerSecurityProvider key={session.imageCacheScope} session={session} onLogout={signOut}>
    <Dashboard session={session} args={args} signOut={signOut} />
  </WorkerSecurityProvider>;
}
