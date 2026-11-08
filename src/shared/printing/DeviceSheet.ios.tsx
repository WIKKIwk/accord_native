import { Button, Host, List, ProgressView, Section, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { disabled } from '@expo/ui/swift-ui/modifiers';
import type { DevicePickerAdapter, DevicePickerTextHook } from './devicePickerTypes';
import { useDevicePicker } from './useDevicePicker';

type DeviceSheetProps = { operator: DevicePickerAdapter; close(): void; useText: DevicePickerTextHook; safe?: boolean };

export function DeviceSheet({ operator, close, useText, safe }: DeviceSheetProps) {
  const picker = useDevicePicker(operator, close, safe), address = useNativeState(picker.address), t = useText();
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
