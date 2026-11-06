import { monitorSnapshotFromJson, type MonitorSnapshot } from './gscaleMonitor';
import type { FetchLike } from './gscaleDiscovery';
import type { GscaleMonitorEvent } from '../../modules/accord-gscale/src/AccordGscaleModule';

type StreamFactory = (baseUrl: string, listener: (event: GscaleMonitorEvent) => void) => Promise<() => void>;
type Callbacks = { onSnapshot(snapshot: MonitorSnapshot): void; onError(message: string): void;
  onLatency(milliseconds: number): void; onUnavailable(message: string): void };

async function timedGet(fetcher: FetchLike, url: string, timeout: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => { const response = await fetcher(url); return { status: response.status, body: await response.text() }; })(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Request timed out')), timeout); }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}

/** @v2 _refresh */
export async function refreshGScaleMonitor(fetcher: FetchLike, baseUrl: string): Promise<MonitorSnapshot> {
  const health = await timedGet(fetcher, `${baseUrl}/healthz`, 4000);
  if (health.status < 200 || health.status > 299) throw new Error(`healthz ${health.status}`);
  const monitor = await timedGet(fetcher, `${baseUrl}/v1/mobile/monitor/state`, 4000);
  if (monitor.status < 200 || monitor.status > 299) throw new Error(`monitor ${monitor.status}`);
  const json: unknown = JSON.parse(monitor.body);
  if (!json || typeof json !== 'object' || Array.isArray(json)) throw new TypeError('Invalid monitor response');
  return monitorSnapshotFromJson(json as Record<string, unknown>);
}

/** V2's _startLiveStream, _runLiveStream and _startPingLoop. */
export class GScaleLiveMonitor {
  private generation = 0;
  private streamStop: (() => void) | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pingInFlight = false;
  private failures = 0;

  constructor(private readonly baseUrl: string, private readonly fetcher: FetchLike,
    private readonly stream: StreamFactory, private readonly callbacks: Callbacks) {}

  start(): void {
    this.stop();
    const generation = this.generation;
    void this.ping(generation);
    this.pingTimer = setInterval(() => { void this.ping(generation); }, 1000);
    void this.connect(generation);
  }

  stop(): void {
    this.generation++;
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.pingTimer = null; this.retryTimer = null; this.pingInFlight = false; this.failures = 0;
    this.streamStop?.(); this.streamStop = null;
  }

  private async ping(generation: number): Promise<void> {
    if (generation !== this.generation || this.pingInFlight) return;
    this.pingInFlight = true;
    const started = Date.now();
    try {
      const response = await timedGet(this.fetcher, `${this.baseUrl}/healthz`, 2000);
      if (response.status < 200 || response.status > 299) throw new Error(`healthz ${response.status}`);
      if (generation !== this.generation) return;
      this.failures = 0;
      this.callbacks.onLatency(Date.now() - started);
    } catch (error) {
      if (generation !== this.generation) return;
      if (++this.failures >= 2) {
        const message = String(error);
        this.stop();
        this.callbacks.onLatency(0);
        this.callbacks.onUnavailable(message);
      }
    } finally { if (generation === this.generation) this.pingInFlight = false; }
  }

  private async connect(generation: number): Promise<void> {
    if (generation !== this.generation) return;
    let finished = false, cancel: (() => void) | null = null;
    const finish = (error?: string) => {
      if (finished || generation !== this.generation) return;
      finished = true;
      if (error) this.callbacks.onError(error);
      cancel?.();
      if (this.streamStop === cancel) this.streamStop = null;
      this.retryTimer = setTimeout(() => { this.retryTimer = null; void this.connect(generation); }, 1000);
    };
    try {
      cancel = await this.stream(this.baseUrl, event => {
        if (generation !== this.generation || finished) return;
        if (event.type === 'error') { finish(event.value); return; }
        if (event.type === 'end') { finish(); return; }
        if (event.type !== 'data') return;
        try {
          const value: unknown = JSON.parse(event.value);
          if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid monitor response');
          const payload = value as Record<string, unknown>;
          if (Object.hasOwn(payload, 'error') && payload.ok !== true) this.callbacks.onError(String(payload.error));
          else this.callbacks.onSnapshot(monitorSnapshotFromJson(payload));
        } catch (error) { finish(String(error)); }
      });
      if (generation !== this.generation || finished) cancel();
      else this.streamStop = cancel;
    } catch (error) { finish(String(error)); }
  }
}
