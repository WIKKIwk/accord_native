import { Button, Host, List, ProgressView, Section, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { useEffect, useState } from 'react';
import { NativeBluetoothPrinter, type BluetoothPrinterProfile } from '../printing/nativePrinter';
import { preparationPrinterServerUrl, type PreparationDeviceSelection } from './preparationPrinter';
import { usePreparationText } from './PreparationUI';

export function PreparationPrinterPicker({ select }: { select: (value: PreparationDeviceSelection | null) => void }) {
  const t = usePreparationText(), input = useNativeState('http://gscale.local:39117');
  const [address, setAddress] = useState('http://gscale.local:39117');
  const [devices, setDevices] = useState<BluetoothPrinterProfile[]>([]);
  const [scanning, setScanning] = useState(true), [error, setError] = useState('');
  useEffect(() => {
    let active = true, stop: (() => void) | null = null;
    void NativeBluetoothPrinter.discoverPrinters(event => {
      if (!active) return;
      if (event.completed) setScanning(false);
      if (event.printer) {
        const printer = event.printer;
        setDevices(previous => previous.some(item => item.address === printer.address) ? previous : [...previous, printer]);
      }
    }).then(dispose => { if (active) stop = dispose; else dispose(); })
      .catch(reason => { if (active) { setScanning(false); setError(reason instanceof Error ? reason.message : String(reason)); } });
    return () => { active = false; stop?.(); };
  }, []);
  return <Host style={{ minHeight: 400 }}><VStack><Text>{t('Printer yoki tarozi tanlash')}</Text><List>
    <Section title="Bluetooth">{scanning && <ProgressView />}
      {devices.map(printer => <Button key={printer.address} label={printer.displayName}
        onPress={() => select({ transport: 'bluetooth', printer })} />)}</Section>
    <Section title="Wi-Fi"><TextField text={input} placeholder={t('Server manzili')} onTextChange={setAddress} />
      <Button label={t('Manzil qo‘shish')} onPress={() => {
        try { select({ transport: 'wifi', serverBaseUrl: preparationPrinterServerUrl(address) }); }
        catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
      }} /></Section>
    {!!error && <Section><Text>{error}</Text></Section>}
  </List><Button label={t('Bekor qilish')} role="cancel" onPress={() => select(null)} /></VStack></Host>;
}
