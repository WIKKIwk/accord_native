import type { GScaleDeviceState } from '../../gscale/gscaleDeviceState';
import { parseServerEndpoint, shouldSkipDiscoveryHost, type DiscoveredServer, type DiscoveryResult,
  type ServerEndpoint } from '../../gscale/gscaleDiscovery';
import type { PrintDeviceSelection } from '../../gscale/gscalePreferences';
import type { DevicePickerAdapter } from './devicePickerTypes';

type Connection = GScaleDeviceState['connection'];
type Dependencies = { isCurrent(): boolean; scan(): Promise<DiscoveryResult>; probe(endpoint: ServerEndpoint): Promise<DiscoveredServer | null>;
  validateSelection?: (selection: PrintDeviceSelection) => void | Promise<void> };

/** A one-shot picker. Unlike the GScale operator, it never restores or saves a device or session Bluetooth printer. */
export function createTransientDevicePicker(deps: Dependencies) {
  let device: GScaleDeviceState = { selection: null, transport: 'wifi', needsAttention: false, connection: null,
    scanning: false, scanResult: null, checkingAddress: false, addressError: '' };
  let snapshot = { device }, finished = false, generation = 0, acceptedGeneration: number | null = null;
  const listeners = new Set<() => void>();
  let resolveResult: (selection: PrintDeviceSelection | null) => void = () => {};
  const result = new Promise<PrintDeviceSelection | null>(resolve => { resolveResult = resolve; });
  const update = (patch: Partial<GScaleDeviceState>) => {
    if (finished) return;
    device = { ...device, ...patch }; snapshot = { device };
    for (const listener of listeners) listener();
  };
  const scopeCurrent = () => { try { return deps.isCurrent(); } catch { return false; } };
  const finish = (selection: PrintDeviceSelection | null) => {
    if (finished) { if (selection === null) acceptedGeneration = null; return; }
    const accepted = scopeCurrent() ? selection : null;
    acceptedGeneration = accepted === null ? null : generation;
    finished = true; generation++; listeners.clear(); resolveResult(accepted);
  };
  const current = () => {
    if (finished) return false;
    if (!scopeCurrent()) { finish(null); return false; }
    return true;
  };
  const adapter: DevicePickerAdapter = {
    subscribe: listener => { if (!finished) listeners.add(listener); return () => listeners.delete(listener); },
    getSnapshot: () => snapshot,
    selectConnection: (connection: Connection) => {
      if (!current()) return;
      // Going back invalidates in-flight discovery/probes; their results must not select or update a later page.
      generation++; update({ connection, scanning: false, checkingAddress: false, addressError: '' });
      if (connection === 'wifi') void adapter.scanDevices();
    },
    scanDevices: async () => {
      if (!current() || device.scanning || device.connection !== 'wifi') return;
      const version = generation; update({ scanning: true });
      try {
        const scanResult = await deps.scan();
        if (current() && version === generation) update({ scanResult, scanning: false });
      } catch {
        if (current() && version === generation) update({ scanResult: device.scanResult ?? { servers: [], candidateCount: 0 }, scanning: false });
      }
    },
    checkDeviceAddress: async raw => {
      if (!current() || device.checkingAddress || device.connection !== 'wifi') return null;
      const version = generation; update({ checkingAddress: true, addressError: '' });
      const endpoint = parseServerEndpoint(raw);
      if (!endpoint) { update({ checkingAddress: false, addressError: 'Manzil formati noto‘g‘ri' }); return null; }
      if (shouldSkipDiscoveryHost(endpoint.host)) {
        update({ checkingAddress: false, addressError: 'Localhost emas, Wi‑Fi server manzilini kiriting' }); return null;
      }
      let server: DiscoveredServer | null;
      try { server = await deps.probe(endpoint); } catch { server = null; }
      if (!current() || version !== generation) return null;
      if (!server) update({ checkingAddress: false, addressError: 'Bu server bilan qo‘shilish muvaffaqiyatsiz' });
      else update({ checkingAddress: false });
      return server;
    },
    selectionToken: () => generation,
    isSelectionCurrent: token => finished ? acceptedGeneration === token && scopeCurrent() : current() && token === generation,
    selectDevice: async selection => {
      if (!current()) return false;
      const version = generation;
      try { await deps.validateSelection?.(selection); }
      catch (error) { if (!current() || version !== generation) return false; throw error; }
      if (!current() || version !== generation) return false;
      finish(selection); return true;
    },
  };
  return { adapter, result, cancel: () => finish(null), dispose: () => finish(null) };
}
