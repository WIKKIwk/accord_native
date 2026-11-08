import type { GScaleDeviceState } from '../../gscale/gscaleDeviceState';
import type { DiscoveredServer } from '../../gscale/gscaleDiscovery';
import type { PrintDeviceSelection } from '../../gscale/gscalePreferences';

/** The existing GScale operator satisfies this narrow picker interface without an adapter. */
export type DevicePickerAdapter = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => { device: GScaleDeviceState };
  selectConnection: (connection: 'wifi' | 'bluetooth' | 'usb' | null) => void;
  scanDevices: () => Promise<void>;
  checkDeviceAddress: (raw: string) => Promise<DiscoveredServer | null>;
  selectDevice: (selection: PrintDeviceSelection) => Promise<void | boolean>;
  // One-shot adapters initiate closure; their owner resolves the result only on sheet dismissal.
  completeSelection?: (close: () => void) => void;
  // Optional for one-shot adapters; GScale intentionally retains its existing behavior.
  selectionToken?: () => number;
  isSelectionCurrent?: (token: number) => boolean;
};
export type DevicePickerTextHook = () => (value: string) => string;
