import type { AccountStorage } from '../savedAccountStore';
import { parseServerEndpoint, printerServerActivity, shouldSkipDiscoveryHost, type DiscoveredServer, type ServerEndpoint } from './gscaleDiscovery';
import type { BluetoothPrinterProfile } from '../printing/nativePrinter';
import type { UsbPrinterProfile } from '../printing/printModels';

const keys = { server: 'accord_v4_gscale_last_server_base_url', servers: 'accord_v4_gscale_cached_servers_v1',
  device: 'accord_v4_gscale_last_print_device_v1' };
const text = (value: unknown, fallback = '') => value == null || !String(value).trim() ? fallback : String(value).trim();
const intValue = (value: unknown) => /^[+-]?\d+$/.test(text(value)) ? Number(text(value)) : null;
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

export type PrintDeviceSelection = { transport: 'wifi'; server: DiscoveredServer } |
  { transport: 'bluetooth'; bluetoothPrinter: BluetoothPrinterProfile } |
  { transport: 'offline'; offlinePrinter: UsbPrinterProfile };
export type SavedPrintDevice = {
  transport: 'wifi' | 'bluetooth' | 'offline'; server_base_url: string; server_name: string; server_display_name: string;
  server_role: string; server_ref: string; bluetooth_name: string; bluetooth_address: string; usb_kind: string;
  usb_device_name: string; usb_vendor_id: number; usb_product_id: number; usb_manufacturer_name: string; usb_product_name: string;
};
export type PrintDeviceResolver = {
  probe(endpoint: ServerEndpoint): Promise<DiscoveredServer | null>;
  pairedPrinters(): Promise<BluetoothPrinterProfile[]>;
  detectOfflinePrinter(): Promise<UsbPrinterProfile>;
};
const blankDevice = (transport: SavedPrintDevice['transport']): SavedPrintDevice => ({ transport, server_base_url: '', server_name: '',
  server_display_name: '', server_role: '', server_ref: '', bluetooth_name: '', bluetooth_address: '', usb_kind: '',
  usb_device_name: '', usb_vendor_id: 0, usb_product_id: 0, usb_manufacturer_name: '', usb_product_name: '' });

/** @v2 SavedPrintDevice */
export function savedPrintDevice(selection: PrintDeviceSelection): SavedPrintDevice | null {
  const saved = blankDevice(selection.transport);
  if (selection.transport === 'wifi') {
    const server = selection.server;
    return { ...saved, server_base_url: server.endpoint.baseUrl, server_name: server.handshake.serverName,
      server_display_name: server.handshake.displayName, server_role: server.handshake.role, server_ref: server.handshake.serverRef };
  }
  if (selection.transport === 'bluetooth') {
    if (!selection.bluetoothPrinter.address.trim()) return null;
    return { ...saved, bluetooth_name: selection.bluetoothPrinter.name, bluetooth_address: selection.bluetoothPrinter.address };
  }
  const printer = selection.offlinePrinter;
  return { ...saved, usb_kind: printer.kind, usb_device_name: printer.deviceName, usb_vendor_id: printer.vendorId,
    usb_product_id: printer.productId, usb_manufacturer_name: printer.manufacturerName, usb_product_name: printer.productName };
}

function parseSavedDevice(value: unknown): SavedPrintDevice | null {
  if (!isObject(value)) return null;
  const transport = text(value.transport).toLowerCase();
  if (transport !== 'wifi' && transport !== 'bluetooth' && transport !== 'offline') return null;
  const result = blankDevice(transport);
  for (const key of ['server_base_url', 'server_name', 'server_display_name', 'server_role', 'server_ref', 'bluetooth_name',
    'bluetooth_address', 'usb_kind', 'usb_device_name', 'usb_manufacturer_name', 'usb_product_name'] as const) result[key] = text(value[key]);
  result.usb_vendor_id = intValue(value.usb_vendor_id) ?? 0;
  result.usb_product_id = intValue(value.usb_product_id) ?? 0;
  return result;
}

/** @v2 restoreLastPrintDevice */
export async function restoreLastPrintDevice(saved: SavedPrintDevice, resolver: PrintDeviceResolver): Promise<PrintDeviceSelection | null> {
  try {
    if (saved.transport === 'wifi') {
      const endpoint = parseServerEndpoint(saved.server_base_url);
      if (!endpoint || shouldSkipDiscoveryHost(endpoint.host)) return null;
      const server = await resolver.probe(endpoint);
      return server ? { transport: 'wifi', server } : null;
    }
    if (saved.transport === 'bluetooth') {
      const normalize = (value: string) => value.trim().toLowerCase().replace(/[^a-f0-9]/g, '');
      const address = normalize(saved.bluetooth_address);
      if (!address) return null;
      const printer = (await resolver.pairedPrinters()).find(value => normalize(value.address) === address);
      return printer ? { transport: 'bluetooth', bluetoothPrinter: printer } : null;
    }
    const printer = await resolver.detectOfflinePrinter();
    if ((saved.usb_kind && printer.kind !== saved.usb_kind) || (saved.usb_vendor_id && printer.vendorId !== saved.usb_vendor_id) ||
        (saved.usb_product_id && printer.productId !== saved.usb_product_id)) return null;
    return { transport: 'offline', offlinePrinter: printer };
  } catch { return null; }
}

export class GScalePreferences {
  constructor(private readonly storage: AccountStorage) {}

  /** @v2 saveLastUsedServer */
  async saveLastUsedServer(endpoint: ServerEndpoint): Promise<void> { await this.storage.setItem(keys.server, endpoint.baseUrl); }

  /** @v2 loadLastUsedServer */
  async loadLastUsedServer(): Promise<ServerEndpoint | null> {
    const value = await this.storage.getItem(keys.server);
    if (!value?.trim()) return null;
    const endpoint = parseServerEndpoint(value);
    if (!endpoint || shouldSkipDiscoveryHost(endpoint.host)) { await this.storage.removeItem(keys.server); return null; }
    return endpoint;
  }

  /** @v2 saveLastPrintDevice */
  async saveLastPrintDevice(selection: PrintDeviceSelection): Promise<void> {
    const saved = savedPrintDevice(selection);
    if (!saved) return;
    await this.storage.setItem(keys.device, JSON.stringify(saved));
    if (selection.transport === 'wifi') await this.saveLastUsedServer(selection.server.endpoint);
  }

  /** @v2 loadLastPrintDevice */
  async loadLastPrintDevice(): Promise<SavedPrintDevice | null> {
    const raw = await this.storage.getItem(keys.device);
    if (!raw?.trim()) {
      const endpoint = await this.loadLastUsedServer();
      return endpoint ? { ...blankDevice('wifi'), server_base_url: endpoint.baseUrl } : null;
    }
    try {
      const saved = parseSavedDevice(JSON.parse(raw));
      if (saved) return saved;
    } catch { /* Invalid saved selections are removed below. */ }
    await this.storage.removeItem(keys.device);
    return null;
  }

  /** @v2 saveCachedDiscoveredServers */
  async saveCachedDiscoveredServers(servers: DiscoveredServer[]): Promise<void> {
    await this.storage.setItem(keys.servers, JSON.stringify(servers.slice(0, 8).map(server => ({ host: server.endpoint.host,
      port: server.endpoint.port, base_url: server.endpoint.baseUrl, server_name: server.handshake.serverName,
      display_name: server.handshake.displayName, role: server.handshake.role, server_ref: server.handshake.serverRef,
      latency_ms: server.latencyMs }))));
  }

  /** @v2 clearCachedDiscoveredServers */
  async clearCachedDiscoveredServers(): Promise<void> { await this.storage.removeItem(keys.servers); }

  /** @v2 loadCachedDiscoveredServers */
  async loadCachedDiscoveredServers(): Promise<DiscoveredServer[]> {
    const raw = await this.storage.getItem(keys.servers);
    if (raw?.trim()) {
      try {
        const payload: unknown = JSON.parse(raw);
        if (Array.isArray(payload)) {
          const out: DiscoveredServer[] = [];
          for (const item of payload) {
            if (!isObject(item)) continue;
            const endpoint = parseServerEndpoint(text(item.base_url));
            if (!endpoint || shouldSkipDiscoveryHost(endpoint.host)) continue;
            out.push({ endpoint, latencyMs: intValue(item.latency_ms) ?? 1, handshake: {
              serverName: text(item.server_name, endpoint.host), displayName: text(item.display_name, 'Operator'),
              role: text(item.role, 'operator'), serverRef: text(item.server_ref, 'cached'), printActivity: printerServerActivity(false),
            } });
          }
          if (out.length) return out;
        }
      } catch { /* Fall back to the last endpoint as V2 does. */ }
    }
    const endpoint = await this.loadLastUsedServer();
    return endpoint ? [{ endpoint, latencyMs: 1, handshake: { serverName: endpoint.host, displayName: 'Recent server',
      role: 'operator', serverRef: 'cached', printActivity: printerServerActivity(false) } }] : [];
  }
}

/** @v2 MaterialWarehousePreferences */
export class MaterialWarehousePreferences {
  private readonly key: string;
  constructor(private readonly storage: AccountStorage, userKey: string) { this.key = `accord_v4_material_receipt_warehouses_v1:${userKey}`; }
  private async read(): Promise<Record<string, { count?: number; last?: number }>> {
    try {
      const data: unknown = JSON.parse(await this.storage.getItem(this.key) ?? '{}');
      return isObject(data) ? data as Record<string, { count?: number; last?: number }> : {};
    } catch { return {}; }
  }
  async record(warehouse: string): Promise<void> {
    const values = await this.read(), name = warehouse.trim().toLowerCase();
    if (!name) return;
    const sequence = Object.values(values).reduce((max, value) => isObject(value) && typeof value.last === 'number' && value.last > max ? Math.trunc(value.last) : max, 0);
    const previous = values[name];
    values[name] = { count: (typeof previous?.count === 'number' ? previous.count : 0) + 1, last: sequence + 1 };
    await this.storage.setItem(this.key, JSON.stringify(values));
  }
  async preferred(allowed: Iterable<string>): Promise<string | null> {
    const names = [...new Set(allowed)], values = await this.read();
    const score = (name: string, field: 'count' | 'last') => Math.trunc(values[name.trim().toLowerCase()]?.[field] ?? 0);
    names.sort((a, b) => score(b, 'count') - score(a, 'count') || score(b, 'last') - score(a, 'last'));
    return !names.length || (names.length > 1 && score(names[0], 'count') === 0) ? null : names[0];
  }
}
