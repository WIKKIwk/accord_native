import { Button, Host, List, ProgressView, Section, Text, VStack } from '@expo/ui/swift-ui';
import { disabled } from '@expo/ui/swift-ui/modifiers';
import { useEffect, useRef, useState } from 'react';
import { NativeBluetoothPrinter, type BluetoothPrinterProfile } from '../printing/nativePrinter';
import type { PreparationDeviceSelection } from './preparationPrinter';
import { usePreparationText } from './PreparationUI';

export function PreparationPrinterPicker({ select, emptyLabel = 'Printer topilmadi', title = 'Printer tanlang' }: { select: (value: PreparationDeviceSelection | null) => void; emptyLabel?: string; title?: string }) {
  const t = usePreparationText();
  const [devices, setDevices] = useState<BluetoothPrinterProfile[]>([]);
  const [scanning, setScanning] = useState(true), [scanVersion, setScanVersion] = useState(0);
  const [error, setError] = useState(''), settled = useRef(false);
  const finish = (value: PreparationDeviceSelection | null) => {
    if (settled.current) return;
    settled.current = true; select(value);
  };
  useEffect(() => {
    let active = true, stop: (() => void) | null = null;
    void NativeBluetoothPrinter.discoverPrinters(event => {
      if (!active) return;
      if (event.completed) setScanning(false);
      if (event.printer) {
        const printer = event.printer;
        setDevices(previous => previous.some(item => item.address === printer.address)
          ? previous.map(item => item.address === printer.address ? printer : item) : [...previous, printer]);
      }
    }).then(dispose => { if (active) stop = dispose; else dispose(); })
      .catch(reason => { if (active) { setScanning(false); setError(reason instanceof Error ? reason.message : String(reason)); } });
    return () => { active = false; stop?.(); };
  }, [scanVersion]);
  return <Host style={{ minHeight: 400 }}><VStack><Text>{t(title)}</Text><List>
    <Section title="Bluetooth">{scanning && <ProgressView />}
      {!scanning && !devices.length && !error && <Text>{t(emptyLabel)}</Text>}
      {devices.map(printer => <Button key={printer.address} label={printer.displayName}
        onPress={() => finish({ transport: 'bluetooth', printer })} />)}
      <Button label={t('Qayta qidirish')} modifiers={[disabled(scanning)]} onPress={() => {
        setDevices([]); setScanning(true); setError(''); setScanVersion(value => value + 1);
      }} />
    </Section>
    {!!error && <Section><Text>{error}</Text></Section>}
  </List><Button label={t('Bekor qilish')} role="cancel" onPress={() => finish(null)} /></VStack></Host>;
}
