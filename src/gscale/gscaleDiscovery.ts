/** Local GScale server discovery and probing, from gscale_mobile_app.dart. */

export type ServerEndpoint = { host: string; port: number; baseUrl: string };
export type PrinterServerActivity = {
  busy: boolean; status: string; label: string; detail: string;
  itemCode: string; itemName: string; printer: string;
};
export type ServerHandshake = {
  serverName: string; displayName: string; role: string; serverRef: string;
  printActivity: PrinterServerActivity;
};
export type DiscoveredServer = { endpoint: ServerEndpoint; handshake: ServerHandshake; latencyMs: number };
export type DiscoveryResult = { servers: DiscoveredServer[]; candidateCount: number };
export type DiscoveryRecord = Record<string, unknown>;
export type DiscoveryChannel = {
  discoverServices(options: { timeout_ms: number; service_types: string[] }): Promise<DiscoveryRecord[]>;
  discoverAnnouncements(options: { port: number; timeout_ms: number }): Promise<DiscoveryRecord[]>;
};
export type FetchLike = (url: string) => Promise<{ status: number; text(): Promise<string> }>;

const defaultPort = 39117;
const directPorts = [39117, 41257, 43391, 45533, 47681];
const serviceTypes = ['_gscale-mobileapi._tcp.', '_rp-scale._tcp.'];
const defaultAddress = 'http://gscale.local:39117';
const text = (value: unknown, fallback = '') => value == null || !String(value).trim() ? fallback : String(value).trim();
const boolValue = (value: unknown) => value === true || ['true', '1', 'yes'].includes(text(value).toLowerCase());
const intValue = (value: unknown): number | null => {
  const raw = text(value);
  return /^[+-]?\d+$/.test(raw) ? Number(raw) : null;
};
const idleActivity = (): PrinterServerActivity => ({ busy: false, status: 'idle', label: "Bo'sh", detail: '', itemCode: '', itemName: '', printer: '' });

/** @v2 parseServerEndpoint */
export function parseServerEndpoint(raw: string): ServerEndpoint | null {
  let value = raw.trim();
  if (!value) return null;
  if (!value.includes('://')) value = `http://${value}`;
  try {
    const uri = new URL(value);
    const host = uri.hostname;
    if (!host.trim()) return null;
    const port = uri.port ? Number(uri.port) : defaultPort;
    return { host, port, baseUrl: `${uri.protocol}//${host}:${port}` };
  } catch { return null; }
}

/** @v2 _shouldSkipDiscoveryHost */
export function shouldSkipDiscoveryHost(host: string): boolean {
  return ['127.0.0.1', 'localhost', '::1', '[::1]', '10.0.2.2'].includes(host.trim().toLowerCase());
}

/** @v2 PrinterServerActivity */
export function printerServerActivity(value: unknown): PrinterServerActivity {
  const json = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
  const busy = boolValue(json ? json.busy : value);
  if (!busy) return idleActivity();
  return {
    busy: true, status: text(json?.status, 'printing'), label: text(json?.label, 'Band'),
    detail: text(json?.detail, "Printer server boshqa mobile print so'rovi bilan band."),
    itemCode: text(json?.item_code), itemName: text(json?.item_name), printer: text(json?.printer),
  };
}

/** @v2 ServerHandshake */
export function serverHandshake(json: Record<string, unknown>): ServerHandshake {
  return {
    serverName: text(json.server_name, 'gscale-zebra'), displayName: text(json.display_name, 'Operator'),
    role: text(json.role, 'operator'), serverRef: text(json.server_ref, 'unknown'),
    printActivity: printerServerActivity(json.print_activity != null ? json.print_activity : json.busy),
  };
}

/** @v2 DiscoveredServer */
export function discoveryKey(server: DiscoveredServer): string {
  const ref = server.handshake.serverRef.trim().toLowerCase();
  const name = server.handshake.serverName.trim().toLowerCase();
  return ref && ref !== 'unknown' && ref !== 'legacy-healthz'
    ? `${ref}|${name}` : `${server.endpoint.host}:${server.endpoint.port}`.toLowerCase();
}

/** @v2 mergeDiscoveryResults */
export function mergeDiscoveryResults(current: DiscoveryResult | null, next: DiscoveryResult, keepCurrentWhenNextEmpty: boolean): DiscoveryResult {
  if (!next.servers.length) return keepCurrentWhenNextEmpty && current?.servers.length ? current : next;
  const merged = new Map(next.servers.map(server => [discoveryKey(server), server]));
  for (const server of current?.servers ?? []) if (!merged.has(discoveryKey(server))) merged.set(discoveryKey(server), server);
  return { servers: [...merged.values()], candidateCount: next.candidateCount };
}

/** @v2 driverUrlForRs */
export function driverUrlForRs(server: DiscoveredServer): string {
  const ref = server.handshake.serverRef.trim().toLowerCase();
  const name = server.handshake.serverName.trim().toLowerCase();
  if (ref === '5070' || name === 'rp-scale-5070') return 'http://100.117.62.18:39117';
  if (ref === 'rp-scale-godex-2' || name === 'rp-scale-godex-2') return `http://100.117.62.18:${server.endpoint.port}`;
  return server.endpoint.baseUrl;
}

/** @v2 printTargetLabel */
export function printTargetLabel(server: DiscoveredServer): string {
  const ref = server.handshake.serverRef.trim();
  const name = server.handshake.serverName.trim();
  return `${(ref && ref !== 'unknown' ? ref : name) || `${server.endpoint.host}:${server.endpoint.port}`} @ ${server.endpoint.port}`;
}

/** @v2 _buildDirectProbeTargets */
export function buildDirectProbeTargets(preferred: ServerEndpoint | null, configured = parseServerEndpoint(defaultAddress)): ServerEndpoint[] {
  const targets = new Map<string, ServerEndpoint>();
  function addHost(host: string, preferredPort?: number) {
    if (shouldSkipDiscoveryHost(host)) return;
    for (const port of new Set([...(preferredPort == null ? [] : [preferredPort]), ...directPorts])) {
      const endpoint = { host, port, baseUrl: `http://${host}:${port}` };
      if (!targets.has(endpoint.baseUrl)) targets.set(endpoint.baseUrl, endpoint);
    }
  }
  if (preferred) addHost(preferred.host, preferred.port);
  if (configured) addHost(configured.host, configured.port);
  addHost('gscale.local');
  return [...targets.values()];
}

async function readJson(fetcher: FetchLike, url: string, timeoutMs: number): Promise<{ status: number; json: Record<string, unknown> }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetcher(url);
        const body = await response.text();
        if (response.status < 200 || response.status >= 300) return { status: response.status, json: {} };
        const json: unknown = JSON.parse(body);
        if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error('Expected a JSON object');
        return { status: response.status, json: json as Record<string, unknown> };
      })(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), timeoutMs); }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}

/** @v2 probeServer */
export async function probeServer(fetcher: FetchLike, endpoint: ServerEndpoint, timeoutMs = 350): Promise<DiscoveredServer | null> {
  const started = Date.now();
  try {
    const result = await readJson(fetcher, `${endpoint.baseUrl}/v1/mobile/handshake`, timeoutMs);
    if (result.status >= 200 && result.status < 300) {
      if (text(result.json.service) !== 'mobileapi') return null;
      return { endpoint, handshake: serverHandshake(result.json), latencyMs: Date.now() - started };
    }
  } catch { /* V2 falls back to healthz. */ }
  try {
    const result = await readJson(fetcher, `${endpoint.baseUrl}/healthz`, timeoutMs);
    if (result.status < 200 || result.status >= 300 || text(result.json.service) !== 'mobileapi') return null;
    return {
      endpoint, latencyMs: Date.now() - started,
      handshake: { serverName: endpoint.host, displayName: 'Operator', role: 'operator', serverRef: 'legacy-healthz',
        printActivity: printerServerActivity(result.json.print_activity != null ? result.json.print_activity : result.json.busy) },
    };
  } catch { return null; }
}

async function probeServers(fetcher: FetchLike, endpoints: ServerEndpoint[], timeoutMs: number, concurrency: number): Promise<DiscoveredServer[]> {
  const results: DiscoveredServer[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(endpoints.length, concurrency) }, async () => {
    while (next < endpoints.length) {
      const server = await probeServer(fetcher, endpoints[next++], timeoutMs);
      if (server) results.push(server);
    }
  }));
  return results;
}

function sortServers(servers: DiscoveredServer[], preferred: ServerEndpoint | null): DiscoveredServer[] {
  return servers.sort((a, b) => {
    const preferredA = a.endpoint.baseUrl === preferred?.baseUrl;
    const preferredB = b.endpoint.baseUrl === preferred?.baseUrl;
    return preferredA !== preferredB ? (preferredA ? -1 : 1) :
      a.latencyMs - b.latencyMs || (a.endpoint.baseUrl < b.endpoint.baseUrl ? -1 : a.endpoint.baseUrl > b.endpoint.baseUrl ? 1 : 0);
  });
}

/** @v2 discoverServersFast */
export async function discoverServersFast(fetcher: FetchLike, preferred: ServerEndpoint | null = null): Promise<DiscoveryResult> {
  const targets = buildDirectProbeTargets(preferred);
  return { servers: sortServers(await probeServers(fetcher, targets, 350, 8), preferred), candidateCount: targets.length };
}

/** @v2 discoverServers */
export async function discoverServers(fetcher: FetchLike, channel: DiscoveryChannel, preferred: ServerEndpoint | null = null): Promise<DiscoveryResult> {
  const announcements = channel.discoverAnnouncements({ port: 18081, timeout_ms: 900 }).catch(() => []);
  const platform = channel.discoverServices({ timeout_ms: 900, service_types: serviceTypes }).catch(() => []);
  const targets = buildDirectProbeTargets(preferred);
  const merged = new Map<string, DiscoveredServer>();
  const merge = (server: DiscoveredServer) => {
    const key = discoveryKey(server);
    const previous = merged.get(key);
    if (!previous || server.latencyMs < previous.latencyMs) merged.set(key, server);
  };
  const direct = probeServers(fetcher, targets, 2000, 12);
  const platformScanned = platform.then(records => {
    const seen = new Map<string, ServerEndpoint>();
    for (const record of records) {
      const host = text(record.host);
      if (!host || shouldSkipDiscoveryHost(host)) continue;
      const port = intValue(record.http_port) ?? defaultPort;
      const endpoint = { host, port, baseUrl: `http://${host}:${port}` };
      seen.set(endpoint.baseUrl, endpoint);
    }
    return probeServers(fetcher, [...seen.values()], 2000, 8);
  });
  for (const server of await direct) merge(server);
  for (const record of await announcements) {
    const host = text(record.host);
    if (!host || shouldSkipDiscoveryHost(host)) continue;
    const port = intValue(record.http_port) ?? defaultPort;
    merge({
      endpoint: { host, port, baseUrl: `http://${host}:${port}` }, latencyMs: intValue(record.latency_ms) ?? 1,
      handshake: { serverName: text(record.server_name, host), displayName: text(record.display_name, 'Operator'),
        role: text(record.role, 'operator'), serverRef: text(record.server_ref), printActivity: idleActivity() },
    });
  }
  for (const server of await platformScanned) merge(server);
  return { servers: sortServers([...merged.values()], preferred), candidateCount: targets.length };
}
