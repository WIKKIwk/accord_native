import { NativeModule, requireOptionalNativeModule } from 'expo';

export type AdminSystemInsets = Readonly<{
  platform: 'android' | 'ios'; width: number; height: number;
  viewPaddingBottom: number; systemGestureInsetsBottom: number; viewInsetsBottom: number;
}>;
declare class NativeAccordAdminLayout extends NativeModule<{ onInsetsChange: (event: { metrics: unknown }) => void }> {
  isGestureNavigation(): Promise<unknown>;
  readInsets(): Promise<unknown>;
}
const nativeModule = () => requireOptionalNativeModule<NativeAccordAdminLayout>('AccordAdminLayout');
export function adminSystemInsetsFromNative(value: unknown): AdminSystemInsets | null {
  if (value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw TypeError('Invalid Admin layout insets');
  const row = value as Record<string, unknown>;
  if (row.platform !== 'android' && row.platform !== 'ios') throw TypeError('Invalid Admin layout platform');
  for (const key of ['width', 'height', 'viewPaddingBottom', 'systemGestureInsetsBottom', 'viewInsetsBottom']) {
    if (typeof row[key] !== 'number' || !Number.isFinite(row[key]) || row[key] < 0 || ((key === 'width' || key === 'height') && row[key] === 0)) throw TypeError('Invalid Admin layout measurement');
  }
  return Object.freeze({ platform: row.platform, width: row.width as number, height: row.height as number, viewPaddingBottom: row.viewPaddingBottom as number,
    systemGestureInsetsBottom: row.systemGestureInsetsBottom as number, viewInsetsBottom: row.viewInsetsBottom as number });
}
/** @v2 SystemNavigationMode.isGestureNavigation */
export async function readAdminGestureNavigation(platform: string): Promise<boolean> {
  if (platform !== 'android') return false;
  try { return (await nativeModule()?.isGestureNavigation()) === true; } catch { return false; }
}
/** Missing reader remains explicitly unavailable; it never fabricates Android system-gesture insets. */
export async function readAdminSystemInsets(): Promise<AdminSystemInsets | null> {
  const module = nativeModule(); if (!module || typeof module.readInsets !== 'function') return null;
  return adminSystemInsetsFromNative(await module.readInsets());
}
export function subscribeAdminSystemInsets(listener: () => void): () => void {
  try {
    const module = nativeModule(); if (!module || typeof module.addListener !== 'function') return () => {};
    const subscription = module.addListener('onInsetsChange', () => listener()); return () => subscription.remove();
  } catch { return () => {}; }
}
