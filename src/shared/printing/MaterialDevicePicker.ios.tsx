import { Button, DisclosureGroup, Host, HStack, Image, List, ProgressView, Section, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { buttonStyle, controlSize, disabled, font, foregroundStyle, frame, keyboardType, listStyle, onSubmit, textInputAutocapitalization } from '@expo/ui/swift-ui/modifiers';
import { useEffect, useRef, useState } from 'react';
import { PlatformColor, View } from 'react-native';
import { CustomerSnackbar } from '../../customer/CustomerSnackbar.ios';
import type { DiscoveredServer } from '../../gscale/gscaleDiscovery';
import { useNativeSheet } from '../../nativeSheet';
import type { DevicePickerAdapter, DevicePickerTextHook, MaterialDevicePickerContext } from './devicePickerTypes';
import { useDevicePicker } from './useDevicePicker';
import { useMaterialDeviceNotice } from './useMaterialDeviceNotice';
import { useMaterialManualServer } from './useMaterialManualServer';

type Picker = ReturnType<typeof useDevicePicker>;
type Props = { operator: DevicePickerAdapter; close(): void; useText: DevicePickerTextHook; printerOnly?: boolean;
  materialReceipt: MaterialDevicePickerContext };
const ignoreSnackbarDismiss = () => {};

/** @v2 ManualServerSheet */
export function MaterialManualServer({ picker, useText, close, complete, isCurrent }: {
  picker: Picker; useText: DevicePickerTextHook; close(): void; complete(server: DiscoveredServer): void; isCurrent(): boolean;
}) {
  const address = useNativeState(picker.address), t = useText();
  const submit = useMaterialManualServer(picker.probeAddress, isCurrent, complete);
  useEffect(() => { if (address.get() !== picker.address) address.set(picker.address); }, [address, picker.address]);
  if (!isCurrent()) return null;
  return <Host style={{ flex: 1 }}><List modifiers={[listStyle('insetGrouped')]}>
    <Section><Text modifiers={[font({ textStyle: 'title2', weight: 'bold' })]}>{t('Server qo‘shish')}</Text>
      <Text modifiers={[foregroundStyle(PlatformColor('secondaryLabel'))]}>{t('Masalan: 192.168.1.12:39117')}</Text>
    </Section>
    <Section title={t('Server manzili')}><TextField text={address} placeholder="http://192.168.1.12:39117" onTextChange={picker.setAddress}
      modifiers={[disabled(picker.device.checkingAddress), keyboardType('url'), textInputAutocapitalization('never'), onSubmit(() => { void submit(); })]} />
      {!!picker.device.addressError && <Text modifiers={[foregroundStyle(PlatformColor('systemRed'))]}>{t(picker.device.addressError)}</Text>}
      {!!picker.error && <Text modifiers={[foregroundStyle(PlatformColor('systemRed'))]}>{t(picker.error)}</Text>}
      <Button modifiers={[disabled(picker.device.checkingAddress), buttonStyle('borderedProminent'), controlSize('large'), frame({ minHeight: 50 })]}
        onPress={() => { void submit(); }}><HStack spacing={10}>{picker.device.checkingAddress ? <ProgressView /> : <Image systemName="link" size={22} />}
          <Text>{t(picker.device.checkingAddress ? 'Tekshirilmoqda...' : 'Serverga ulanish')}</Text>
        </HStack></Button>
    </Section>
    <Section><Button label={t('Yopish')} modifiers={[controlSize('large'), frame({ minHeight: 48 })]} onPress={close} /></Section>
  </List></Host>;
}

/** @v2 ServerPickerPage, _ConnectionModeSelection, _DeviceSelectionHeader, _ScanningState, _EmptyServerState, _ServerCard, _OfflineUsbSelection, BluetoothPrinterList */
export function MaterialDevicePicker({ operator, close, useText, materialReceipt, printerOnly = false }: Props) {
  const picker = useDevicePicker(operator, close, true, printerOnly, materialReceipt), t = useText();
  const notice = useMaterialDeviceNotice(picker, materialReceipt);
  const manualSheet = useNativeSheet(), manualResult = useRef<DiscoveredServer | null>(null);
  const [technical, setTechnical] = useState(false);
  const complete = (server: DiscoveredServer) => { if (!materialReceipt.isCurrent()) return; manualResult.current = server; manualSheet.close(); };
  const form = <MaterialManualServer picker={picker} useText={useText} close={manualSheet.close} complete={complete} isCurrent={materialReceipt.isCurrent} />;
  useEffect(() => { if (manualSheet.isOpen()) manualSheet.update(form); });
  const openManual = () => {
    if (!materialReceipt.isCurrent()) return;
    manualResult.current = null;
    manualSheet.open(form, { heightFraction: 0.55, dismissible: true, onDismiss: () => {
      const server = manualResult.current; manualResult.current = null;
      if (server && materialReceipt.isCurrent()) void picker.selectServer(server);
    } });
  };
  const connection = picker.device.connection;
  const title = connection === 'wifi' ? 'Wi-Fi qurilma' : connection === 'bluetooth' ? 'Bluetooth printer' : connection === 'usb' ? 'USB printer' : 'Qurilma tanlash';
  if (!materialReceipt.isCurrent()) return null;
  return <View style={{ flex: 1 }}><Host style={{ flex: 1 }}><List modifiers={[listStyle('insetGrouped')]}>
    <Section><HStack spacing={12}>
      {!!connection && <Button label={t('Orqaga')} systemImage="chevron.left" onPress={() => picker.choose(null)}
        modifiers={[controlSize('large'), frame({ minHeight: 44 })]} />}
      <Text modifiers={[font({ textStyle: 'title2', weight: 'bold' })]}>{t(title)}</Text>
    </HStack></Section>
    {connection == null && <Section>
      {!printerOnly && <Button label={t('USB')} systemImage="cable.connector" modifiers={[buttonStyle('bordered'), controlSize('large'), frame({ minHeight: 52 })]} onPress={() => picker.choose('usb')} />}
      <Button label={t('Bluetooth')} systemImage="printer" modifiers={[buttonStyle('bordered'), controlSize('large'), frame({ minHeight: 52 })]} onPress={() => picker.choose('bluetooth')} />
      {!printerOnly && <Button label={t('Wi-Fi')} systemImage="wifi" modifiers={[buttonStyle('borderedProminent'), controlSize('large'), frame({ minHeight: 52 })]} onPress={() => picker.choose('wifi')} />}
    </Section>}
    {connection === 'wifi' && <>
      <Section><Text modifiers={[font({ textStyle: 'headline' })]}>{t('Printer yoki tarozini tanlang')}</Text>
        <Text modifiers={[foregroundStyle(PlatformColor('secondaryLabel'))]}>{t('Tarmoqdagi ishlayotgan qurilmani tanlang yoki manzilini qo‘shing.')}</Text>
        <Button label={t('Wi-Fi manzilini qo‘shish')} systemImage="link.badge.plus" onPress={openManual}
          modifiers={[controlSize('large'), frame({ minHeight: 48 })]} />
      </Section>
      {picker.device.scanning && !picker.device.scanResult?.servers.length && <Section><HStack spacing={14}><ProgressView />
        <VStack alignment="leading" spacing={4}><Text>{t('Qidirilmoqda...')}</Text><Text modifiers={[foregroundStyle(PlatformColor('secondaryLabel'))]}>{t('Tarmoqdagi printer va tarozilar aniqlanmoqda')}</Text></VStack>
      </HStack></Section>}
      {!picker.device.scanning && !picker.device.scanResult?.servers.length && <Section>
        <Text modifiers={[font({ textStyle: 'headline' })]}>{t('Qurilma tarmoqda topilmadi')}</Text>
        <Text>{t('Lokal Wi-Fi tarmoqda aktiv tarozi yoki printer topilmadi. Qurilma tarmoqqa ulanganini tekshiring.')}</Text>
        <Button label={t('Qayta qidirish')} systemImage="arrow.clockwise" onPress={picker.scan} modifiers={[controlSize('large'), frame({ minHeight: 48 })]} />
      </Section>}
      {!!picker.device.scanResult?.servers.length && <Section>{picker.device.scanResult.servers.map(server => <Button key={server.endpoint.baseUrl}
        onPress={() => { void picker.selectServer(server); }} modifiers={[controlSize('large'), frame({ minHeight: 64 })]}>
        <HStack spacing={12}><Image systemName="wifi" size={26} /><VStack alignment="leading" spacing={4}>
          <Text modifiers={[font({ textStyle: 'headline' })]}>{server.handshake.serverName}</Text>
          <Text modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle(PlatformColor('secondaryLabel'))]}>{`${server.endpoint.host}:${server.endpoint.port}`}</Text>
        </VStack><Text>{t('Ulanish')}</Text></HStack>
      </Button>)}<Button label={t('Qayta qidirish')} systemImage="arrow.clockwise" modifiers={[disabled(picker.device.scanning), controlSize('large'), frame({ minHeight: 48 })]} onPress={picker.scan} /></Section>}
    </>}
    {connection === 'usb' && <Section><Text modifiers={[font({ textStyle: 'headline' })]}>{t('USB printer')}</Text>
      <Text>{t('Printer Android qurilmaga USB orqali ulanadi. RPS service va printer WiFi tarmog‘i talab qilinmaydi.')}</Text>
      <Button modifiers={[disabled(picker.scanning), buttonStyle('borderedProminent'), controlSize('large'), frame({ minHeight: 50 })]}
        onPress={() => { void picker.selectUsb(); }}><HStack spacing={10}>{picker.scanning ? <ProgressView /> : <Image systemName="cable.connector" size={22} />}
          <Text>{t(picker.scanning ? 'USB printer aniqlanmoqda...' : 'USB printerni tanlash')}</Text>
        </HStack></Button>
    </Section>}
    {connection === 'bluetooth' && <>
      {picker.scanning && <Section><HStack spacing={12}><ProgressView /><VStack alignment="leading" spacing={4}><Text>XP-P323B</Text><Text>{t('Bluetooth printer tanlanmoqda...')}</Text></VStack></HStack></Section>}
      {!picker.scanning && !picker.printers.length && <Section><Text modifiers={[font({ textStyle: 'headline' })]}>{t('Bluetooth printer topilmadi')}</Text>
        <Text>{t(picker.friendlyError || 'Printerni yoqing va shu oynada Bluetooth orqali qidiring.')}</Text>
        {!!picker.error && <DisclosureGroup isExpanded={technical} onIsExpandedChange={setTechnical} label={t(technical ? 'Tafsilotlarni yashirish' : 'Texnik ma’lumot')}>
          <Text modifiers={[font({ textStyle: 'caption', design: 'monospaced' }), foregroundStyle(PlatformColor('systemRed'))]}>{picker.error}</Text>
        </DisclosureGroup>}
        <Button label={t('Qayta qidirish')} systemImage="arrow.clockwise" modifiers={[controlSize('large'), frame({ minHeight: 48 })]} onPress={picker.rescanBluetooth} />
      </Section>}
      {!!picker.printers.length && <Section>{picker.printers.map(printer => <Button key={printer.address} onPress={() => { void picker.selectBluetooth(printer); }}
        modifiers={[controlSize('large'), frame({ minHeight: 64 })]}><HStack spacing={12}><Image systemName="printer" size={26} />
          <VStack alignment="leading" spacing={4}><Text modifiers={[font({ textStyle: 'headline' })]}>{printer.displayName}</Text><Text>{printer.address}</Text></VStack><Image systemName="chevron.right" size={18} />
        </HStack></Button>)}</Section>}
    </>}
    {!!picker.error && connection !== 'bluetooth' && connection !== 'usb' && <Section><Text modifiers={[foregroundStyle(PlatformColor('systemRed'))]}>{t(picker.error)}</Text></Section>}
    <Section><Button label={t('Yopish')} modifiers={[controlSize('large'), frame({ minHeight: 48 })]} onPress={close} /></Section>
  </List></Host><CustomerSnackbar message={notice ? t(notice) : ''} messageId={picker.usbErrorRevision} onDismiss={ignoreSnackbarDismiss} /></View>;
}
