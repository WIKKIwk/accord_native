import { useEffect, useState, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { watchGScaleBluetoothDevices } from '../../gscale/gscaleBluetoothDevices';
import type { DiscoveredServer } from '../../gscale/gscaleDiscovery';
import { NativeBluetoothPrinter, type BluetoothPrinterProfile } from '../../printing/nativePrinter';
import { PrintService } from '../../printing/printService';
import type { DevicePickerAdapter } from './devicePickerTypes';

export function useDevicePicker(operator: DevicePickerAdapter, close: () => void) {
  const device = useSyncExternalStore(operator.subscribe, operator.getSnapshot, operator.getSnapshot).device;
  const [printers, setPrinters] = useState<BluetoothPrinterProfile[]>([]), [scanning, setScanning] = useState(false);
  const [scanVersion, setScanVersion] = useState(0);
  const [error, setError] = useState(''), [address, setAddress] = useState('http://gscale.local:39117');
  useEffect(() => { operator.selectConnection(null); }, [operator]);
  useEffect(() => {
    if (device.connection !== 'bluetooth') return;
    let active = true, stop: (() => void) | undefined;
    void watchGScaleBluetoothDevices(Platform.OS, NativeBluetoothPrinter, event => {
      if (!active) return;
      if (event.complete) setScanning(false);
      if (event.paired) setPrinters(event.paired);
      if (event.printer) { const printer = event.printer; setPrinters(old => old.some(value => value.address === printer.address)
        ? old.map(value => value.address === printer.address ? printer : value) : [...old, printer]); }
    }).then(dispose => { if (active) stop = dispose; else dispose(); })
      .catch(reason => { if (active) { setScanning(false); setError(reason instanceof Error ? reason.message : String(reason)); } });
    return () => { active = false; stop?.(); };
  }, [operator, device.connection, scanVersion]);
  const tokenState = () => {
    const token = operator.selectionToken?.();
    return () => token === undefined || operator.isSelectionCurrent?.(token) === true;
  };
  const errorText = (reason: unknown) => reason instanceof Error ? reason.message : String(reason);
  const selectServer = async (server: DiscoveredServer) => {
    const stillCurrent = tokenState(); setError('');
    try { if (await operator.selectDevice({ transport: 'wifi', server }) !== false && stillCurrent()) close(); }
    catch (reason) { if (stillCurrent()) setError(errorText(reason)); }
  };
  const selectBluetooth = async (printer: BluetoothPrinterProfile) => {
    const stillCurrent = tokenState(); setError('');
    try { if (await operator.selectDevice({ transport: 'bluetooth', bluetoothPrinter: printer }) !== false && stillCurrent()) close(); }
    catch (reason) { if (stillCurrent()) setError(errorText(reason)); }
  };
  const selectUsb = async () => {
    const stillCurrent = tokenState(); setError(''); setScanning(true);
    try {
      const offlinePrinter = await PrintService.detectOfflinePrinter();
      if (stillCurrent() && await operator.selectDevice({ transport: 'offline', offlinePrinter }) !== false && stillCurrent()) close();
    } catch (reason) { if (stillCurrent()) setError(errorText(reason)); }
    finally { if (stillCurrent()) setScanning(false); }
  };
  const checkAddress = async () => {
    const stillCurrent = tokenState();
    try { const server = await operator.checkDeviceAddress(address); if (server && stillCurrent()) await selectServer(server); }
    catch (reason) { if (stillCurrent()) setError(errorText(reason)); }
  };
  const scan = async () => {
    const stillCurrent = tokenState();
    try { await operator.scanDevices(); } catch (reason) { if (stillCurrent()) setError(errorText(reason)); }
  };
  return { device, printers, scanning, error, address, setAddress, selectServer, selectBluetooth, selectUsb, checkAddress,
    choose: (connection: 'wifi' | 'bluetooth' | 'usb' | null) => {
      setError(''); setScanning(connection === 'bluetooth'); if (connection === 'bluetooth') setPrinters([]);
      operator.selectConnection(connection);
    },
    rescanBluetooth: () => { setError(''); setPrinters([]); setScanning(true); setScanVersion(value => value + 1); },
    scan: () => void scan() };
}
