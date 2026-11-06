import { Button, Host, List, ProgressView, Section, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { disabled } from '@expo/ui/swift-ui/modifiers';
import { useCallback, useEffect, useRef, useState } from 'react';
import { driverUrlForRs, printTargetLabel, type DiscoveredServer } from '../gscale/gscaleDiscovery';
import { scanGscaleServers } from '../gscale/gscaleDiscoveryRuntime';
import { NativeBluetoothPrinter, type BluetoothPrinterProfile } from '../printing/nativePrinter';
import { preparationManualPrinterServer, type PreparationDeviceSelection } from './preparationPrinter';
import { usePreparationText } from './PreparationUI';

export function PreparationPrinterPicker({ select }: { select: (value: PreparationDeviceSelection | null) => void }) {
  const t = usePreparationText(), input = useNativeState('http://gscale.local:39117');
  const [address, setAddress] = useState('http://gscale.local:39117');
  const [devices, setDevices] = useState<BluetoothPrinterProfile[]>([]);
  const [servers, setServers] = useState<DiscoveredServer[]>([]);
  const [scanning, setScanning] = useState(true), [wifiScanning, setWifiScanning] = useState(true), [checking, setChecking] = useState(false);
  const [error, setError] = useState(''), [wifiError, setWifiError] = useState('');
  const active = useRef(true), settled = useRef(false), checkingRef = useRef(false), scanGeneration = useRef(0), scanRunning = useRef(false);
  const finish = (value: PreparationDeviceSelection | null) => {
    if (settled.current) return;
    settled.current = true; select(value);
  };
  const scan = useCallback(() => {
    if (scanRunning.current) return;
    scanRunning.current = true;
    const generation = ++scanGeneration.current;
    void scanGscaleServers().then(result => {
      if (active.current && generation === scanGeneration.current) setServers(result.servers);
    }).catch(reason => {
      if (active.current && generation === scanGeneration.current) setWifiError(reason instanceof Error ? reason.message : String(reason));
    }).finally(() => {
      if (generation === scanGeneration.current) {
        scanRunning.current = false;
        if (active.current) setWifiScanning(false);
      }
    });
  }, []);
  useEffect(() => {
    const mounted = active, generation = scanGeneration, running = scanRunning;
    mounted.current = true; scan();
    return () => { mounted.current = false; generation.current++; running.current = false; };
  }, [scan]);
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
      {devices.map(printer => <Button key={printer.address} label={printer.displayName} modifiers={[disabled(checking)]}
        onPress={() => finish({ transport: 'bluetooth', printer })} />)}</Section>
    <Section title="Wi-Fi">{wifiScanning && <ProgressView />}
      {servers.map(server => <Button key={server.endpoint.baseUrl} label={`${server.handshake.displayName} · ${printTargetLabel(server)}`}
        modifiers={[disabled(checking)]} onPress={() => finish({ transport: 'wifi', serverBaseUrl: server.endpoint.baseUrl,
          driverBaseUrl: driverUrlForRs(server) })} />)}
      {!!wifiError && <Text>{wifiError}</Text>}
      <Button label={t('Qayta qidirish')} modifiers={[disabled(checking || wifiScanning)]} onPress={() => {
        setWifiError(''); setWifiScanning(true); scan();
      }} />
      <TextField text={input} placeholder={t('Server manzili')} modifiers={[disabled(checking)]} onTextChange={setAddress} />
      {checking && <ProgressView />}
      <Button label={t('Manzil qo‘shish')} modifiers={[disabled(checking)]} onPress={() => {
        if (checkingRef.current) return;
        checkingRef.current = true; setChecking(true); setError('');
        void preparationManualPrinterServer(address).then(value => { if (active.current) finish(value); })
          .catch(reason => { if (active.current && !settled.current) setError(reason instanceof Error ? reason.message : String(reason)); })
          .finally(() => { checkingRef.current = false; if (active.current && !settled.current) setChecking(false); });
      }} /></Section>
    {!!error && <Section><Text>{error}</Text></Section>}
  </List><Button label={t('Bekor qilish')} role="cancel" onPress={() => finish(null)} /></VStack></Host>;
}
