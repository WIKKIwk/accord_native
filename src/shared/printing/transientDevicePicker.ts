import type { GScaleDeviceState } from '../../gscale/gscaleDeviceState';
import { parseServerEndpoint, shouldSkipDiscoveryHost, type DiscoveredServer, type DiscoveryResult,
  type ServerEndpoint } from '../../gscale/gscaleDiscovery';
import type { PrintDeviceSelection } from '../../gscale/gscalePreferences';
import type { DevicePickerAdapter } from './devicePickerTypes';

type Connection = GScaleDeviceState['connection'];
type Dependencies = { isCurrent(): boolean; scan(): Promise<DiscoveryResult>; probe(endpoint: ServerEndpoint): Promise<DiscoveredServer | null>;
  validateSelection?: (selection: PrintDeviceSelection) => void | Promise<void>; dismissTimeoutMs?: number };

/** A one-shot picker. It never restores or saves a device or Bluetooth session.
 * The sheet owner must call onLeaving when dismissal starts, onDismiss after the sheet entry is removed,
 * and dispose on owner unmount/account change. cancel is for a request that cannot be presented. */
export function createTransientDevicePicker(deps: Dependencies) {
  let device: GScaleDeviceState = { selection: null, transport: 'wifi', needsAttention: false, connection: null,
    scanning: false, scanResult: null, checkingAddress: false, addressError: '' };
  let snapshot = { device }, finished = false, leaving = false, closingForSelection = false, generation = 0, selecting = false;
  let staged: PrintDeviceSelection | null = null;
  let dismissalTimer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  let resolveResult: (selection: PrintDeviceSelection | null) => void = () => {};
  const result = new Promise<PrintDeviceSelection | null>(resolve => { resolveResult = resolve; });
  const update = (patch: Partial<GScaleDeviceState>) => {
    if (finished) return;
    device = { ...device, ...patch }; snapshot = { device };
    for (const listener of listeners) listener();
  };
  const scopeCurrent = () => { try { return deps.isCurrent(); } catch { return false; } };
  const clearDismissalTimer = () => { if (dismissalTimer !== undefined) clearTimeout(dismissalTimer); dismissalTimer = undefined; };
  const cancel = () => {
    if (finished) return;
    clearDismissalTimer(); finished = true; staged = null; generation++; listeners.clear(); resolveResult(null);
  };
  // A prevented or lost navigation must not leave a stock action waiting forever.
  const watchDismissal = () => {
    if (dismissalTimer === undefined) dismissalTimer = setTimeout(cancel, deps.dismissTimeoutMs ?? 15000);
  };
  const current = () => {
    if (finished || leaving || closingForSelection) return false;
    if (!scopeCurrent()) { cancel(); return false; }
    return true;
  };
  const adapter: DevicePickerAdapter = {
    subscribe: listener => { if (!finished) listeners.add(listener); return () => listeners.delete(listener); },
    getSnapshot: () => snapshot,
    selectConnection: (connection: Connection) => {
      if (!current()) return;
      // Going back invalidates in-flight discovery/probes; their results must not select or update a later page.
      generation++; staged = null; update({ connection, scanning: false, checkingAddress: false, addressError: '' });
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
    isSelectionCurrent: token => current() && token === generation,
    selectDevice: async selection => {
      if (!current() || selecting || staged !== null) return false;
      const version = generation; selecting = true;
      try { await deps.validateSelection?.(selection); }
      catch (error) { if (!current() || version !== generation) return false; throw error; }
      finally { selecting = false; }
      if (!current() || version !== generation) return false;
      staged = selection; return true;
    },
    completeSelection: close => {
      if (!current() || staged === null) return;
      // Keep the result pending until the originating sheet's onDismiss runs after its entry is removed.
      closingForSelection = true; generation++; listeners.clear(); watchDismissal();
      try { close(); } catch (error) { cancel(); throw error; }
    },
  };
  const onLeaving = () => {
    if (finished || leaving || closingForSelection) return;
    // Invalidate late work immediately, but wait for the native sheet entry to disappear before settling.
    leaving = true; staged = null; generation++; listeners.clear(); watchDismissal();
  };
  const onDismiss = () => {
    if (finished) return;
    const selection = closingForSelection && scopeCurrent() ? staged : null;
    clearDismissalTimer(); finished = true; staged = null; generation++; listeners.clear(); resolveResult(selection);
  };
  return { adapter, result, cancel, dispose: cancel, onLeaving, onDismiss, onRemovalPrevented: cancel };
}
