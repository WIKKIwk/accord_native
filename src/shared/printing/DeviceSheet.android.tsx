import { Host, OutlinedTextField, Text, useNativeState } from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import type { ComponentType } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import type { DevicePickerAdapter, DevicePickerTextHook } from './devicePickerTypes';
import { useDevicePicker } from './useDevicePicker';

type LabelProps = { children: string };
type ActionProps = { label: string; detail?: string; onPress(): void; disabled?: boolean; id?: string };
type DeviceSheetProps = { operator: DevicePickerAdapter; close(): void; useText: DevicePickerTextHook;
  Label: ComponentType<LabelProps>; Action: ComponentType<ActionProps> };

export function DeviceSheet({ operator, close, useText, Label, Action }: DeviceSheetProps) {
  const picker = useDevicePicker(operator, close), address = useNativeState(picker.address), t = useText();
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
