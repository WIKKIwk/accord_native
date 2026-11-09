import { probeServer } from '../../gscale/gscaleDiscovery';
import { scanGscaleServers } from '../../gscale/gscaleDiscoveryRuntime';
import { createTransientDevicePicker } from './transientDevicePicker';

/** No discovery, persistence, or Bluetooth session changes occur until the user interacts with the sheet. */
export function createNativeTransientDevicePicker(isCurrent: () => boolean,
  validateSelection?: Parameters<typeof createTransientDevicePicker>[0]['validateSelection']) {
  return createTransientDevicePicker({ isCurrent, validateSelection, scan: () => scanGscaleServers(),
    probe: endpoint => probeServer(fetch, endpoint, 2000) });
}
