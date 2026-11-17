import { Button, FilledTonalIconButton, Host, OutlinedTextField, RNHostView, Row, Text, TextButton, useMaterialColors, useNativeState } from '@expo/ui/jetpack-compose';
import { defaultMinSize, fillMaxWidth, semantics, testID } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text as NativeText, View, useWindowDimensions } from 'react-native';
import { WorkerQueueCard } from '../../components/WorkerQueueCard.android';
import { CustomerSnackbar } from '../../customer/CustomerSnackbar.android';
import type { DiscoveredServer } from '../../gscale/gscaleDiscovery';
import { useNativeSheet } from '../../nativeSheet';
import type { DevicePickerAdapter, DevicePickerTextHook, MaterialDevicePickerContext } from './devicePickerTypes';
import { useDevicePicker } from './useDevicePicker';
import { useMaterialDeviceNotice } from './useMaterialDeviceNotice';

type Picker = ReturnType<typeof useDevicePicker>;
type AndroidSymbol = 'link' | 'refresh' | 'usb' | 'info' | 'arrow_back' | 'add_link' | 'wifi_off' | 'devices_other' | 'wifi' | 'chevron_right' | 'print' | 'bluetooth';
type Props = { operator: DevicePickerAdapter; close(): void; useText: DevicePickerTextHook; printerOnly?: boolean;
  materialReceipt: MaterialDevicePickerContext };
const ignoreSnackbarDismiss = () => {};

function Control({ label, icon, press, disabled, filled = false }: {
  label: string; icon: AndroidSymbol; press(): void; disabled?: boolean; filled?: boolean;
}) {
  const Component = filled ? Button : TextButton;
  return <Host matchContents={{ vertical: true }} style={styles.full}><Component enabled={!disabled} onClick={press}
    modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 48 }), testID(`material-device-${icon}`)]}>
    <Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center"><RNHostView matchContents><SymbolView name={{ android: icon }} size={20} /></RNHostView><Text>{label}</Text></Row>
  </Component></Host>;
}

function IconControl({ icon, label, onPress }: { icon: AndroidSymbol; label: string; onPress(): void }) {
  const colors = useMaterialColors();
  return <Host style={{ width: 40, height: 40 }}><FilledTonalIconButton onClick={onPress}
    modifiers={[semantics({ contentDescription: label }), testID(`material-device-${icon}`)]}><RNHostView matchContents>
      <SymbolView name={{ android: icon }} size={22} tintColor={colors.primary} />
    </RNHostView></FilledTonalIconButton></Host>;
}

/** @v2 ManualServerSheet */
function MaterialManualServer({ picker, useText, complete, isCurrent }: {
  picker: Picker; useText: DevicePickerTextHook; complete(server: DiscoveredServer): void; isCurrent(): boolean;
}) {
  const colors = useMaterialColors(), address = useNativeState(picker.address), t = useText(), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (address.get() !== picker.address) address.set(picker.address); }, [address, picker.address]);
  const submit = async () => { const server = await picker.probeAddress(); if (server && mounted.current && isCurrent()) complete(server); };
  if (!isCurrent()) return null;
  return <View style={{ paddingHorizontal: 18, paddingBottom: 18, gap: 16 }}>
    <View style={{ gap: 8 }}><NativeText style={[styles.title, { color: colors.onSurface }]}>{t('Server qo‘shish')}</NativeText>
      <NativeText style={[styles.body, { color: colors.onSurfaceVariant }]}>{t('Masalan: 192.168.1.12:39117')}</NativeText></View>
    <Host matchContents={{ vertical: true }} style={styles.full}><OutlinedTextField value={address} singleLine enabled={!picker.device.checkingAddress}
      keyboardOptions={{ keyboardType: 'uri', imeAction: 'go' }} onValueChange={picker.setAddress} keyboardActions={{ onGo: () => { void submit(); } }} modifiers={[fillMaxWidth(), testID('material-device-address')]}>
      <OutlinedTextField.Label><Text>{t('Server manzili')}</Text></OutlinedTextField.Label>
      <OutlinedTextField.Placeholder><Text>http://192.168.1.12:39117</Text></OutlinedTextField.Placeholder>
    </OutlinedTextField></Host>
    {!!(picker.device.addressError || picker.error) && <NativeText style={[styles.body, { color: colors.error }]}>{t(picker.device.addressError || picker.error)}</NativeText>}
    <Control label={t(picker.device.checkingAddress ? 'Tekshirilmoqda...' : 'Serverga ulanish')} icon="link" filled
      disabled={picker.device.checkingAddress} press={() => { void submit(); }} />
  </View>;
}

/** @v2 ServerPickerPage, _ConnectionModeSelection, _DeviceSelectionHeader, _ScanningState, _EmptyServerState, _ServerCard, _OfflineUsbSelection, BluetoothPrinterList */
export function MaterialDevicePicker({ operator, useText, materialReceipt, printerOnly = false, close }: Props) {
  const picker = useDevicePicker(operator, close, true, printerOnly, materialReceipt), t = useText(), colors = useMaterialColors(), { height } = useWindowDimensions();
  const notice = useMaterialDeviceNotice(picker, materialReceipt);
  const manualSheet = useNativeSheet(), manualResult = useRef<DiscoveredServer | null>(null), [technical, setTechnical] = useState(false);
  const complete = (server: DiscoveredServer) => { if (!materialReceipt.isCurrent()) return; manualResult.current = server; manualSheet.close(); };
  const form = <MaterialManualServer picker={picker} useText={useText} complete={complete} isCurrent={materialReceipt.isCurrent} />;
  useEffect(() => { if (manualSheet.isOpen()) manualSheet.update(form); });
  const openManual = () => {
    if (!materialReceipt.isCurrent()) return;
    manualResult.current = null;
    manualSheet.open(form, { fitContent: true, dismissible: true, onDismiss: () => {
      const server = manualResult.current; manualResult.current = null;
      if (server && materialReceipt.isCurrent()) void picker.selectServer(server);
    } });
  };
  const connection = picker.device.connection, servers = picker.device.scanResult?.servers ?? [];
  const title = connection === 'wifi' ? 'Wi-Fi qurilma' : connection === 'bluetooth' ? 'Bluetooth printer' : connection === 'usb' ? 'USB printer' : 'Qurilma tanlash';
  const icon = (name: AndroidSymbol, size = 24) => <SymbolView name={{ android: name }} size={size} tintColor={colors.primary} />;
  const message = (heading: string, detail: string, spinning = false) => <View style={[styles.message, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}>
    {spinning ? <ActivityIndicator color={colors.primary} /> : icon('wifi_off', 30)}
    <View style={{ flex: 1, gap: 4 }}><NativeText style={[styles.headline, { color: colors.onSurface }]}>{t(heading)}</NativeText>
      <NativeText style={[styles.supporting, { color: colors.onSurfaceVariant }]}>{t(detail)}</NativeText></View>
  </View>;
  if (!materialReceipt.isCurrent()) return null;
  return <View testID="material-device-picker" style={{ paddingBottom: 24, backgroundColor: colors.surface }}>
    <View style={[styles.header, { paddingLeft: connection ? 12 : 20 }]}>
      {connection ? <IconControl icon="arrow_back" label={t('Orqaga')} onPress={() => picker.choose(null)} /> : null}
      <NativeText style={[styles.title, { color: colors.onSurface, flex: 1 }]}>{t(title)}</NativeText>
      {connection === 'wifi' ? <IconControl icon="add_link" label={t('Wi-Fi manzilini qo‘shish')} onPress={openManual} /> : connection ? <View style={{ width: 40 }} /> : null}
    </View>
    {connection == null ? <View style={{ flexDirection: 'row', padding: 16, gap: 8 }}>
      {([{ id: 'usb', label: 'USB', symbol: 'usb' }, { id: 'bluetooth', label: 'Bluetooth', symbol: 'bluetooth' }, { id: 'wifi', label: 'Wi-Fi', symbol: 'wifi' }] as const)
        .filter(option => !printerOnly || option.id === 'bluetooth').map(option => <View key={option.id} style={{ flex: 1 }}>
          <Host matchContents={{ vertical: true }} style={styles.full}><TextButton onClick={() => picker.choose(option.id)} modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 116 }), testID(`material-device-${option.id}`)]}>
            <RNHostView matchContents><View style={{ alignItems: 'center', gap: 10 }}><View style={[styles.connectionIcon, { backgroundColor: colors.secondaryContainer }]}>{icon(option.symbol, 28)}</View>
              <NativeText style={[styles.headline, { color: colors.onSurface }]}>{option.label}</NativeText></View></RNHostView>
          </TextButton></Host></View>)}
    </View> : <ScrollView style={{ maxHeight: height * 0.68 }} nestedScrollEnabled keyboardShouldPersistTaps="handled"
      refreshControl={connection === 'wifi' ? <RefreshControl refreshing={picker.device.scanning} onRefresh={picker.scan} /> : undefined} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
      {connection === 'wifi' ? <>
        <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 18, paddingHorizontal: 2 }}>
          <View style={[styles.connectionIcon, { width: 44, height: 44, backgroundColor: colors.primaryContainer }]}>{icon('devices_other', 22)}</View>
          <View style={{ flex: 1, gap: 4 }}><NativeText style={[styles.headline, { color: colors.onSurface }]}>{t('Printer yoki tarozini tanlang')}</NativeText>
            <NativeText style={[styles.supporting, { color: colors.onSurfaceVariant }]}>{t('Tarmoqdagi ishlayotgan qurilmani tanlang yoki manzilini qo‘shing.')}</NativeText></View>
        </View>
        {picker.device.scanning && !servers.length ? message('Qidirilmoqda...', 'Tarmoqdagi printer va tarozilar aniqlanmoqda', true) : null}
        {!picker.device.scanning && !servers.length ? <>{message('Qurilma tarmoqda topilmadi', 'Lokal Wi-Fi tarmoqda aktiv tarozi yoki printer topilmadi. Qurilma tarmoqqa ulanganini tekshiring.')}
          <Control label={t('Qayta qidirish')} icon="refresh" press={picker.scan} /></> : null}
        {servers.map((server, index) => <WorkerQueueCard key={server.endpoint.baseUrl} first={index === 0} last={index === servers.length - 1}
          backgroundColor={colors.surfaceContainerLow} onPress={() => { void picker.selectServer(server); }}>
          <View style={[styles.serverIcon, { backgroundColor: colors.tertiaryContainer }]}>{icon('wifi')}</View><View style={{ flex: 1, gap: 4, paddingVertical: 10, marginLeft: 14 }}>
            <NativeText style={[styles.headline, { color: colors.onSurface }]}>{server.handshake.serverName}</NativeText>
            <NativeText style={[styles.supporting, { color: colors.onSurfaceVariant }]}>{`${server.endpoint.host}:${server.endpoint.port}`}</NativeText></View>{icon('chevron_right', 20)}
        </WorkerQueueCard>)}
      </> : null}
      {connection === 'usb' ? <View style={[styles.usb, { backgroundColor: colors.surfaceContainerLow }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>{icon('usb', 30)}<NativeText style={[styles.headline, { color: colors.onSurface }]}>{t('USB printer')}</NativeText></View>
        <NativeText style={[styles.body, { color: colors.onSurfaceVariant }]}>{t('Printer Android qurilmaga USB orqali ulanadi. RPS service va printer WiFi tarmog‘i talab qilinmaydi.')}</NativeText>
        <Control label={t(picker.scanning ? 'USB printer aniqlanmoqda...' : 'USB printerni tanlash')} icon="usb" filled disabled={picker.scanning} press={() => { void picker.selectUsb(); }} />
      </View> : null}
      {connection === 'bluetooth' ? <>
        {picker.scanning ? message('XP-P323B', 'Bluetooth printer tanlanmoqda...', true) : null}
        {!picker.scanning && !picker.printers.length ? <View style={{ gap: 8 }}>{message('Bluetooth printer topilmadi', picker.friendlyError || 'Printerni Android Bluetooth sozlamalarida avval bog‘lang (pair).')}
          {!!picker.error && <><Control label={t(technical ? 'Tafsilotlarni yashirish' : 'Texnik ma’lumot')} icon="info" press={() => setTechnical(value => !value)} />
            {technical && <NativeText selectable style={[styles.supporting, { color: colors.error, fontFamily: 'monospace' }]}>{picker.error}</NativeText>}</>}
          <Control label={t('Qayta qidirish')} icon="refresh" press={picker.rescanBluetooth} /></View> : null}
        {picker.printers.map((printer, index) => <WorkerQueueCard key={printer.address} first={index === 0} last={index === picker.printers.length - 1}
          backgroundColor={colors.surfaceContainerLow} onPress={() => { void picker.selectBluetooth(printer); }}>
          <View style={styles.serverIcon}>{icon('print')}</View><View style={{ flex: 1, gap: 4, paddingVertical: 12, marginLeft: 12 }}>
            <NativeText style={[styles.headline, { color: colors.onSurface }]}>{printer.displayName}</NativeText><NativeText style={[styles.supporting, { color: colors.onSurfaceVariant }]}>{printer.address}</NativeText>
          </View>{icon('chevron_right', 20)}</WorkerQueueCard>)}
      </> : null}
      {!!picker.error && connection !== 'bluetooth' && connection !== 'usb' && <NativeText style={[styles.body, { color: colors.error }]}>{t(picker.error)}</NativeText>}
    </ScrollView>}
    <CustomerSnackbar message={notice ? t(notice) : ''} messageId={picker.usbErrorRevision} onDismiss={ignoreSnackbarDismiss} />
  </View>;
}

const styles = StyleSheet.create({
  full: { width: '100%' }, header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 10, paddingBottom: 4, paddingRight: 16 },
  title: { fontSize: 24, lineHeight: 32, fontWeight: '800', letterSpacing: -0.3 }, headline: { fontSize: 16, lineHeight: 24, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 20 }, supporting: { fontSize: 12, lineHeight: 17 }, connectionIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  serverIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, message: { flexDirection: 'row', alignItems: 'center', borderWidth: 0.4, borderRadius: 20, padding: 16, gap: 14 },
  usb: { borderRadius: 12, padding: 18, gap: 14, marginTop: 16 },
});
