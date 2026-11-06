import { NativeModule, requireOptionalNativeModule } from 'expo';

export type GscaleDiscoveryOptions = { timeout_ms: number; service_types: string[] };
export type GscaleAnnouncementOptions = { port: number; timeout_ms: number };
export type GscaleDiscoveryRecord = Record<string, unknown>;
export type GscaleMonitorEvent = { session: number; type: 'open' | 'data' | 'error' | 'end'; value: string };

declare class NativeAccordGscale extends NativeModule<{ onMonitorStream: (event: GscaleMonitorEvent) => void }> {
  discoverServices?: (options: GscaleDiscoveryOptions) => Promise<GscaleDiscoveryRecord[]>;
  discoverBonjourServices?: (options: GscaleDiscoveryOptions) => Promise<GscaleDiscoveryRecord[]>;
  discoverAnnouncements: (options: GscaleAnnouncementOptions) => Promise<GscaleDiscoveryRecord[]>;
  startMonitorStream: (session: number, baseUrl: string) => Promise<void>;
  stopMonitorStream: (session: number) => Promise<void>;
}

let monitorSession = 0;

function nativeModule(): NativeAccordGscale {
  const module = requireOptionalNativeModule<NativeAccordGscale>('AccordGscale');
  if (!module) throw new Error('GScale discovery requires a development build');
  return module;
}

export const AccordGscale = {
  discoverServices(options: GscaleDiscoveryOptions): Promise<GscaleDiscoveryRecord[]> {
    const module = nativeModule();
    if (!module.discoverServices) throw new Error('NSD discovery is unavailable on this platform');
    return module.discoverServices(options);
  },
  discoverBonjourServices(options: GscaleDiscoveryOptions): Promise<GscaleDiscoveryRecord[]> {
    const module = nativeModule();
    if (!module.discoverBonjourServices) throw new Error('Bonjour discovery is unavailable on this platform');
    return module.discoverBonjourServices(options);
  },
  discoverAnnouncements(options: GscaleAnnouncementOptions): Promise<GscaleDiscoveryRecord[]> {
    return nativeModule().discoverAnnouncements(options);
  },
  async monitorStream(baseUrl: string, listener: (event: GscaleMonitorEvent) => void): Promise<() => void> {
    const module = nativeModule();
    const session = ++monitorSession;
    const subscription = module.addListener('onMonitorStream', event => {
      if (event.session === session) listener(event);
    });
    try { await module.startMonitorStream(session, baseUrl); }
    catch (error) { subscription.remove(); throw error; }
    return () => { subscription.remove(); void module.stopMonitorStream(session); };
  },
};
