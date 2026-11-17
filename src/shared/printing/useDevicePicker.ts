import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { watchGScaleBluetoothDevices } from '../../gscale/gscaleBluetoothDevices';
import { parseServerEndpoint, shouldSkipDiscoveryHost, type DiscoveredServer } from '../../gscale/gscaleDiscovery';
import { NativeBluetoothPrinter, type BluetoothPrinterProfile } from '../../printing/nativePrinter';
import { PrintService } from '../../printing/printService';
import type { DevicePickerAdapter, MaterialDevicePickerContext } from './devicePickerTypes';

function selectionGuard(operator: DevicePickerAdapter): () => boolean {
  try {
    const token = operator.selectionToken?.();
    return () => { try { return token === undefined || operator.isSelectionCurrent?.(token) === true; } catch { return false; } };
  } catch { return () => false; }
}

export function useDevicePicker(operator: DevicePickerAdapter, close: () => void, safe = false, printerOnly = false, materialReceipt?: MaterialDevicePickerContext) {
  const device = useSyncExternalStore(operator.subscribe, operator.getSnapshot, operator.getSnapshot).device;
  const [printers, setPrinters] = useState<BluetoothPrinterProfile[]>([]), [scanning, setScanning] = useState(false);
  const [scanVersion, setScanVersion] = useState(0);
  const [error, setError] = useState(''), [address, setAddress] = useState(() => materialReceipt ? materialDeviceAddress(materialReceipt.apiBaseUrl) : 'http://gscale.local:39117');
  const [usbErrorRevision, setUsbErrorRevision] = useState(0);
  const mounted = useRef(true);
  const current = () => { try { return !materialReceipt || mounted.current && materialReceipt.isCurrent() === true; } catch { return false; } };
  useEffect(() => { mounted.current = true; operator.selectConnection(null); return () => { mounted.current = false; }; }, [operator]);
  const materialCurrent = materialReceipt?.isCurrent;
  const lifetimeSelectionGuard = () => { const selected = selectionGuard(operator); return () => current() && selected(); };
  useEffect(() => {
    if (device.connection !== 'bluetooth') return;
    const selectedCurrent = safe ? selectionGuard(operator) : () => true;
    const stillCurrent = () => { try { return selectedCurrent() && (!materialCurrent || mounted.current && materialCurrent() === true); } catch { return false; } };
    if (!stillCurrent() || (safe && operator.getSnapshot().device.connection !== 'bluetooth')) return;
    let active = true, stop: (() => void) | undefined;
    void watchGScaleBluetoothDevices(Platform.OS, NativeBluetoothPrinter, event => {
      if (!active || !stillCurrent()) return;
      if (event.complete) setScanning(false);
      if (event.paired) setPrinters(event.paired);
      if (event.printer) { const printer = event.printer; setPrinters(old => old.some(value => value.address === printer.address)
        ? old.map(value => value.address === printer.address ? printer : value) : [...old, printer]); }
    }).then(dispose => { if (active && stillCurrent()) stop = dispose; else dispose(); })
      .catch(reason => { if (active && stillCurrent()) { setScanning(false); setError(reason instanceof Error ? reason.message : String(reason)); } });
    return () => { active = false; stop?.(); };
  }, [operator, device.connection, scanVersion, safe, materialCurrent]);
  const errorText = (reason: unknown) => reason instanceof Error ? reason.message : String(reason);
  const completeSelection = () => { if (operator.completeSelection) operator.completeSelection(close); else close(); };
  const selectServer = async (server: DiscoveredServer) => {
    if (printerOnly || !current()) return;
    if (!safe) {
      try { if (await operator.selectDevice({ transport: 'wifi', server }) !== false && current()) close(); }
      catch (reason) { if (!materialReceipt) throw reason; if (current()) setError(errorText(reason)); }
      return;
    }
    const stillCurrent = lifetimeSelectionGuard(); if (!stillCurrent()) return; setError('');
    try { if (await operator.selectDevice({ transport: 'wifi', server }) !== false && stillCurrent()) completeSelection(); }
    catch (reason) { if (stillCurrent()) setError(errorText(reason)); }
  };
  const selectBluetooth = async (printer: BluetoothPrinterProfile) => {
    if (!current()) return;
    if (!safe) {
      try { if (await operator.selectDevice({ transport: 'bluetooth', bluetoothPrinter: printer }) !== false && current()) close(); }
      catch (reason) { if (!materialReceipt) throw reason; if (current()) setError(errorText(reason)); }
      return;
    }
    const stillCurrent = lifetimeSelectionGuard(); if (!stillCurrent()) return; setError('');
    try { if (await operator.selectDevice({ transport: 'bluetooth', bluetoothPrinter: printer }) !== false && stillCurrent()) completeSelection(); }
    catch (reason) { if (stillCurrent()) setError(errorText(reason)); }
  };
  const selectUsb = async () => {
    if (printerOnly || !current()) return;
    if (!safe) {
      const token = operator.selectionToken?.();
      const stillCurrent = () => current() && (token === undefined || operator.isSelectionCurrent?.(token) === true);
      setError(''); setScanning(true);
      try {
        const offlinePrinter = await PrintService.detectOfflinePrinter();
        if (stillCurrent() && await operator.selectDevice({ transport: 'offline', offlinePrinter }) !== false && stillCurrent()) close();
      } catch (reason) { if (stillCurrent()) { setError(materialReceipt ? `USB printer aniqlanmadi: ${errorText(reason)}` : errorText(reason)); if (materialReceipt) setUsbErrorRevision(value => value + 1); } }
      finally { if (stillCurrent()) setScanning(false); }
      return;
    }
    const stillCurrent = lifetimeSelectionGuard(); if (!stillCurrent()) return; setError(''); setScanning(true);
    try {
      if (!stillCurrent()) return;
      const offlinePrinter = await PrintService.detectOfflinePrinter();
      if (stillCurrent() && await operator.selectDevice({ transport: 'offline', offlinePrinter }) !== false && stillCurrent()) completeSelection();
    } catch (reason) { if (stillCurrent()) { setError(materialReceipt ? `USB printer aniqlanmadi: ${errorText(reason)}` : errorText(reason)); if (materialReceipt) setUsbErrorRevision(value => value + 1); } }
    finally { if (stillCurrent()) setScanning(false); }
  };
  const probeAddress = async (): Promise<DiscoveredServer | null> => {
    if (!current()) return null;
    const stillCurrent = lifetimeSelectionGuard();
    try { const server = await operator.checkDeviceAddress(address); return current() && stillCurrent() ? server : null; }
    catch (reason) { if (current() && stillCurrent()) setError(errorText(reason)); return null; }
  };
  const checkAddress = async () => {
    if (!current()) return;
    if (!safe) { const server = await operator.checkDeviceAddress(address); if (server) await selectServer(server); return; }
    const stillCurrent = lifetimeSelectionGuard();
    try { const server = await operator.checkDeviceAddress(address); if (server && stillCurrent()) await selectServer(server); }
    catch (reason) { if (stillCurrent()) setError(errorText(reason)); }
  };
  const scan = async () => {
    if (!current()) return;
    const stillCurrent = lifetimeSelectionGuard();
    try { await operator.scanDevices(); } catch (reason) { if (stillCurrent()) setError(errorText(reason)); }
  };
  return { device, printers, scanning, error, usbErrorRevision, friendlyError: materialReceipt && device.connection === 'bluetooth' ? materialBluetoothError(error) : error, address, setAddress, selectServer, selectBluetooth, selectUsb, checkAddress, probeAddress,
    choose: (connection: 'wifi' | 'bluetooth' | 'usb' | null) => {
      if (!current()) return;
      if (printerOnly && connection !== null && connection !== 'bluetooth') return;
      if (safe && !lifetimeSelectionGuard()()) return;
      setError(''); setScanning(connection === 'bluetooth'); if (connection === 'bluetooth') setPrinters([]);
      operator.selectConnection(connection);
    },
    rescanBluetooth: () => { if (!current()) return; if (safe && !lifetimeSelectionGuard()()) return; setError(''); setPrinters([]); setScanning(true); setScanVersion(value => value + 1); },
    scan: () => { if (!current()) return; if (safe) void scan(); else void operator.scanDevices(); } };
}

/** @v2 _sanitizeManualServerAddress */
export function materialDeviceAddress(raw: string) {
  const endpoint = parseServerEndpoint(raw);
  return !endpoint || shouldSkipDiscoveryHost(endpoint.host) ? 'http://gscale.local:39117' : endpoint.baseUrl;
}

/** @v2 BluetoothPrinterList._userFriendlyError */
export function materialBluetoothError(rawError: string) {
  if (!rawError) return '';
  if (rawError.includes('MissingPluginException')) return 'Bluetooth printer tizim moduli ushbu muhitda faol emas. Qurilma Bluetooth sozlamalarini tekshiring.';
  if (rawError.toLowerCase().includes('permission')) return 'Bluetooth ruxsatlari taqdim etilmagan. Sozlamalardan ruxsat bering.';
  return 'Bluetooth printerlarni izlashda kutilmagan xatolik yuz berdi.';
}
