import { NativeModule, requireOptionalNativeModule } from 'expo';

export type NativeProductionSocketEvent = { session: string; type: 'open' | 'message' | 'error' | 'close'; value: string; statusCode?: number };

declare class NativeAccordProductionLive extends NativeModule<{ onProductionSocket: (event: NativeProductionSocketEvent) => void }> {
  open(origin: string, target: string): string;
  stop(id: string): void;
}

export function productionLiveNativeModule(): NativeAccordProductionLive | null {
  return requireOptionalNativeModule<NativeAccordProductionLive>('AccordProductionLive');
}
