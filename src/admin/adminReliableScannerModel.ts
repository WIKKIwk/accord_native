import type { AdminProgressQrBarcode } from './adminProgressQrInput';

export type AdminReliableScannerPhase = 'idle' | 'starting' | 'recovering' | 'running' | 'stopping' | 'suspended' | 'error' | 'disposed';
export type AdminReliableScannerTorch = 'unavailable' | 'off' | 'on';
/** These must come from the original native driver, never React mount/cleanup, preview-pause or an elapsed timer. */
export type AdminReliableScannerCompletion = Readonly<{ nativeIdentity: object; operation: 'start' | 'stop' | 'dispose' }>;
export type AdminReliableScannerNativeState = Readonly<{ nativeIdentity: object; runIdentity: object | null;
  initialized: boolean; isRunning: boolean; hasCameraPermission: boolean; error: unknown | null; torch: AdminReliableScannerTorch }>;
export type AdminReliableScannerCapture = Readonly<{ nativeIdentity: object; runIdentity: object; barcodes: readonly AdminProgressQrBarcode[] }>;
export type AdminReliableScannerDetectionError = Readonly<{ nativeIdentity: object; runIdentity: object; error: unknown }>;
export type AdminReliableScannerTorchReceipt = Readonly<{ nativeIdentity: object; runIdentity: object; torch: AdminReliableScannerTorch }>;
/** Required real native adapter. Installed Expo Camera does not implement this full contract. No default implementation is supplied. */
export type AdminReliableScannerDriver = Readonly<{
  nativeIdentity: object; getState: () => AdminReliableScannerNativeState;
  start: () => Promise<AdminReliableScannerCompletion>; stop: () => Promise<AdminReliableScannerCompletion>; dispose: () => Promise<AdminReliableScannerCompletion>;
  subscribeCaptures: (listener: (receipt: AdminReliableScannerCapture) => void) => () => void;
  subscribeDetectionErrors: (listener: (receipt: AdminReliableScannerDetectionError) => void) => () => void;
  subscribeTorch: (listener: (receipt: AdminReliableScannerTorchReceipt) => void) => () => void;
  toggleTorch: () => Promise<AdminReliableScannerTorchReceipt>;
}>;
export type AdminReliableScannerReporter = (error: unknown, context: 'coordinator' | 'detection') => void;
export type AdminReliableScannerTimers = Readonly<{ set: (callback: () => void, milliseconds: number) => ReturnType<typeof setTimeout>; clear: (timer: ReturnType<typeof setTimeout>) => void }>;
export type AdminReliableScannerSnapshot = Readonly<{ phase: AdminReliableScannerPhase; lastError: unknown | null; recoveryCount: number; disposed: boolean }>;
export const adminReliableScannerStartTimeout = 8000, adminReliableScannerReleaseTimeout = 4000;
const object = (value: unknown): value is object => value !== null && typeof value === 'object' && !Array.isArray(value);
export function adminReliableScannerDriver(driver: AdminReliableScannerDriver): AdminReliableScannerDriver {
  if (!driver || !object(driver.nativeIdentity) || [driver.getState, driver.start, driver.stop, driver.dispose, driver.subscribeCaptures, driver.subscribeDetectionErrors, driver.subscribeTorch, driver.toggleTorch].some(value => typeof value !== 'function')) throw TypeError('A genuine original native scanner driver is required');
  // Preserve class receivers while preventing a later props mutation from replacing
  // the original driver's methods or native resource identity.
  return Object.freeze({ nativeIdentity: driver.nativeIdentity, getState: driver.getState.bind(driver), start: driver.start.bind(driver), stop: driver.stop.bind(driver), dispose: driver.dispose.bind(driver),
    subscribeCaptures: driver.subscribeCaptures.bind(driver), subscribeDetectionErrors: driver.subscribeDetectionErrors.bind(driver), subscribeTorch: driver.subscribeTorch.bind(driver), toggleTorch: driver.toggleTorch.bind(driver) });
}
export function adminReliableScannerState(driver: AdminReliableScannerDriver): AdminReliableScannerNativeState {
  const state = driver.getState();
  if (!state || state.nativeIdentity !== driver.nativeIdentity || typeof state.initialized !== 'boolean' || typeof state.isRunning !== 'boolean' || typeof state.hasCameraPermission !== 'boolean' ||
    state.hasCameraPermission && !state.initialized || state.runIdentity !== null && !object(state.runIdentity) || state.isRunning && state.runIdentity === null || !['unavailable', 'off', 'on'].includes(state.torch)) throw TypeError('Original native scanner state is required');
  return state;
}
export function adminReliableScannerCompletion(driver: AdminReliableScannerDriver, operation: AdminReliableScannerCompletion['operation'], receipt: AdminReliableScannerCompletion): void {
  if (!receipt || receipt.nativeIdentity !== driver.nativeIdentity || receipt.operation !== operation) throw TypeError('Original native scanner completion is required');
}
export async function adminReliableScannerTimeout<T>(operation: Promise<T>, milliseconds: number, timers: AdminReliableScannerTimers): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([operation, new Promise<never>((_, reject) => {
    timer = timers.set(() => { const error = new Error('Future not completed'); error.name = 'TimeoutError'; reject(error); }, milliseconds);
  })]); } finally { if (timer !== undefined) timers.clear(timer); }
}
