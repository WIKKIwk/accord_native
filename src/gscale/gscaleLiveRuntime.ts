import { AccordGscale } from '../../modules/accord-gscale/src/AccordGscaleModule';
import { GScaleLiveMonitor } from './gscaleLive';

export function createGScaleLiveMonitor(baseUrl: string, callbacks: ConstructorParameters<typeof GScaleLiveMonitor>[3]) {
  return new GScaleLiveMonitor(baseUrl, fetch, AccordGscale.monitorStream, callbacks);
}
