import { Box, Column, Host, Icon, IconButton, OutlinedButton, OutlinedTextField, Row, Text, TextButton, useMaterialColors, useNativeState } from '@expo/ui/jetpack-compose';
import { background, clip, defaultMinSize, fillMaxWidth, semantics, Shapes, size, testID, weight } from '@expo/ui/jetpack-compose/modifiers';
import type { ComponentType } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text as NativeText, View, useWindowDimensions } from 'react-native';
import { WorkerQueueCard } from '../../components/WorkerQueueCard.android';
import type { DevicePickerAdapter, DevicePickerTextHook } from './devicePickerTypes';
import { useDevicePicker } from './useDevicePicker';

type LabelProps = { children: string };
type ActionProps = { label: string; detail?: string; onPress(): void; disabled?: boolean; id?: string };
type DeviceSheetProps = { operator: DevicePickerAdapter; close(): void; useText: DevicePickerTextHook;
  Label: ComponentType<LabelProps>; Action: ComponentType<ActionProps>; safe?: boolean; printerOnly?: boolean };
const icons = {
  usb: require('../../../assets/icons/gscale/usb.xml'), bluetooth: require('../../../assets/icons/gscale/bluetooth.xml'),
  wifi: require('../../../assets/icons/gscale/wifi.xml'), back: require('../../../assets/icons/gscale/arrow_back.xml'),
  refresh: require('../../../assets/icons/gscale/refresh.xml'), close: require('../../../assets/icons/gscale/close.xml'),
};
const connections = [{ id: 'usb', label: 'USB' }, { id: 'bluetooth', label: 'Bluetooth' }, { id: 'wifi', label: 'Wi-Fi' }] as const;

function DeviceRow({ title, detail, icon, first, last, onPress }: {
  title: string; detail: string; icon: 'bluetooth' | 'wifi'; first: boolean; last: boolean; onPress(): void;
}) {
  const colors = useMaterialColors();
  return <WorkerQueueCard backgroundColor={colors.surface} first={first} last={last} onPress={onPress}>
    <View style={[styles.icon, { backgroundColor: colors.surfaceContainerHighest }]}>
      <Host style={{ width: 24, height: 24 }}><Icon source={icons[icon]} size={24} tint={colors.onSurfaceVariant} /></Host>
    </View>
    <View style={styles.rowText}>
      <NativeText numberOfLines={1} style={[styles.headline, { color: colors.onSurface }]}>{title}</NativeText>
      <NativeText numberOfLines={1} style={[styles.supporting, { color: colors.onSurfaceVariant }]}>{detail}</NativeText>
    </View>
  </WorkerQueueCard>;
}

export function DeviceSheet({ operator, close, useText, Label, safe, printerOnly = false }: DeviceSheetProps) {
  const picker = useDevicePicker(operator, close, safe, printerOnly), address = useNativeState(picker.address), t = useText();
  const colors = useMaterialColors(), { height } = useWindowDimensions(), connection = picker.device.connection;
  const listLimit = Math.max(88, Math.min(400, height * 0.7 - (connection === 'wifi' ? 240 : 144)));
  const title = connection === 'bluetooth' ? 'Bluetooth printer' : connection === 'wifi' ? 'Wi-Fi qurilma'
    : connection === 'usb' ? 'USB printer' : 'Qurilma tanlash';
  const servers = picker.device.scanResult?.servers ?? [];
  return <View testID="device-picker" style={styles.root}>
    <Host matchContents={{ vertical: true }} style={styles.full}>
      <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
        {connection ? <IconButton onClick={() => picker.choose(null)} modifiers={[
          testID('device-picker-back'), semantics({ contentDescription: t('Orqaga') }),
        ]}><Icon source={icons.back} size={24} tint={colors.onSurfaceVariant} /></IconButton> : null}
        <Text color={colors.onSurface} style={{ typography: 'titleLarge', fontWeight: '600' }} modifiers={[weight(1)]}>{t(title)}</Text>
        {connection || safe ? <IconButton onClick={close} modifiers={[
          testID('device-picker-close'), semantics({ contentDescription: t('Bekor qilish') }),
        ]}><Icon source={icons.close} size={24} tint={colors.onSurfaceVariant} /></IconButton> : null}
      </Row>
    </Host>
    {connection === null ? <Host matchContents={{ vertical: true }} style={styles.full}>
      <Row horizontalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth()]}>
        {connections.filter(option => !printerOnly || option.id === 'bluetooth').map(option => <TextButton key={option.id} onClick={() => picker.choose(option.id)} contentPadding={{ start: 0, end: 0 }}
          modifiers={[weight(1), defaultMinSize({ minHeight: 116 }), testID(`device-picker-${option.id}`), semantics({ contentDescription: option.label })]}>
          <Column horizontalAlignment="center" verticalArrangement={{ spacedBy: 8 }}>
            <Box contentAlignment="center" modifiers={[size(64, 64), clip(Shapes.RoundedCorner(32)), background(colors.secondaryContainer)]}>
              <Icon source={icons[option.id]} size={28} tint={colors.onSecondaryContainer} />
            </Box>
            <Text color={colors.onSurface} style={{ typography: 'titleMedium' }}>{option.label}</Text>
          </Column>
        </TextButton>)}
      </Row>
    </Host> : null}
    {connection === 'wifi' ? <>
      <Host matchContents={{ vertical: true }} style={styles.full}><OutlinedTextField value={address} singleLine onValueChange={picker.setAddress}
        modifiers={[fillMaxWidth(), testID('device-picker-address')]}>
        <OutlinedTextField.Label><Text>{t('Server manzili')}</Text></OutlinedTextField.Label>
      </OutlinedTextField></Host>
      <Host matchContents={{ vertical: true }} style={styles.full}><OutlinedButton enabled={!picker.device.checkingAddress}
        onClick={() => void picker.checkAddress()} modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 48 }), testID('device-picker-add-address')]}>
        <Text>{t('Wi-Fi manzilini qo‘shish')}</Text>
      </OutlinedButton></Host>
      {!!picker.device.addressError && <Label>{picker.device.addressError}</Label>}
      <FlatList testID="device-picker-wifi-list" data={servers} keyExtractor={server => server.endpoint.baseUrl}
        nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ height: Math.min(listLimit, Math.max(72, servers.length * 72 + 12)) }}
        renderItem={({ item, index }) => <DeviceRow title={item.handshake.serverName} detail={item.endpoint.baseUrl} icon="wifi"
          first={index === 0} last={index === servers.length - 1} onPress={() => void picker.selectServer(item)} />}
        ListEmptyComponent={picker.device.scanning ? <ActivityIndicator style={styles.status} /> : <View style={styles.status}><Label>{t('Qurilma topilmadi')}</Label></View>}
        ListFooterComponent={servers.length > 0 && picker.device.scanning ? <ActivityIndicator style={styles.status} /> : undefined} />
      <Host matchContents={{ vertical: true }} style={styles.full}><TextButton enabled={!picker.device.scanning} onClick={picker.scan}
        modifiers={[fillMaxWidth(), testID('device-picker-refresh')]}><Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}>
          <Icon source={icons.refresh} size={20} /><Text>{t('Yangilash')}</Text></Row></TextButton></Host>
    </> : null}
    {connection === 'bluetooth' ? <>
      <FlatList testID="device-picker-bluetooth-list" data={picker.printers} keyExtractor={printer => printer.address}
        nestedScrollEnabled keyboardShouldPersistTaps="handled" initialNumToRender={6} windowSize={5}
        style={{ height: Math.min(listLimit, Math.max(72, picker.printers.length * 72 + 12)) }}
        renderItem={({ item, index }) => <DeviceRow title={item.displayName} detail={item.address} icon="bluetooth"
          first={index === 0} last={index === picker.printers.length - 1} onPress={() => void picker.selectBluetooth(item)} />}
        ListEmptyComponent={picker.scanning ? <ActivityIndicator style={styles.status} /> : <View style={styles.status}><Label>{t('Printer topilmadi')}</Label></View>}
        ListFooterComponent={picker.printers.length > 0 && picker.scanning ? <ActivityIndicator style={styles.status} /> : undefined} />
      <Host matchContents={{ vertical: true }} style={styles.full}><TextButton enabled={!picker.scanning} onClick={picker.rescanBluetooth}
        modifiers={[fillMaxWidth(), testID('device-picker-refresh')]}><Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}>
          <Icon source={icons.refresh} size={20} /><Text>{t('Yangilash')}</Text></Row></TextButton></Host>
    </> : null}
    {connection === 'usb' ? <>
      {picker.scanning ? <ActivityIndicator style={styles.status} /> : null}
      <Host matchContents={{ vertical: true }} style={styles.full}><OutlinedButton enabled={!picker.scanning} onClick={() => void picker.selectUsb()}
        modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 56 }), testID('device-picker-usb-detect')]}>
        <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}><Icon source={icons.usb} size={24} /><Text>{t('USB printerni aniqlash')}</Text></Row>
      </OutlinedButton></Host>
    </> : null}
    {!!picker.error && <Label>{picker.error}</Label>}
  </View>;
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 20, gap: 12 }, full: { width: '100%' },
  icon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, marginStart: 16, paddingVertical: 6 },
  headline: { fontSize: 16, lineHeight: 24, fontWeight: '500', includeFontPadding: false },
  supporting: { fontSize: 14, lineHeight: 20, includeFontPadding: false }, status: { padding: 16 },
});
