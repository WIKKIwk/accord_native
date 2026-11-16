export type AdminFixedSnackBarRect = Readonly<{ x: number; y: number; width: number; height: number }>;
/** All coordinates must be one genuine original-window/UI-thread snapshot. Activity metrics are not an RNModal window receipt. */
export type AdminFixedSnackBarNativePair = Readonly<{
  window: Readonly<{ identity: object; viewport: AdminFixedSnackBarRect; rawImeBottom: number }>;
  host: Readonly<{ windowIdentity: object; frame: AdminFixedSnackBarRect }>;
  dock: Readonly<{ windowIdentity: object; height: number }>;
  /** ItemCreate's actual bottomNavigationBar removes bottom padding BEFORE fixed SnackBar SafeArea. */
  remainingSafeArea: Readonly<{ left: number; right: number; bottom: 0 }>;
}>;
export type AdminFixedSnackBarGeometry = Readonly<{
  windowIdentity: object; left: number; width: number; bottom: number; viewportHeight: number; safeLeft: number; safeRight: number;
}>;
const nonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const rect = (value: AdminFixedSnackBarRect) => value && [value.x, value.y].every(item => typeof item === 'number' && Number.isFinite(item)) && [value.width, value.height].every(item => nonnegative(item) && item > 0);
/** Installed Flutter _ScaffoldLayout.performLayout fixed SnackBar contentBottom; this SDK method is not an ERP V2 symbol. */
export function adminFixedSnackBarGeometry(pair: AdminFixedSnackBarNativePair | null): AdminFixedSnackBarGeometry | null {
  try {
    if (!pair) return null; const { window, host, dock, remainingSafeArea } = pair;
    if (!window || !window.identity || typeof window.identity !== 'object' || host?.windowIdentity !== window.identity || dock?.windowIdentity !== window.identity ||
      !rect(window.viewport) || !rect(host.frame) || !nonnegative(window.rawImeBottom) || !nonnegative(dock.height) || !remainingSafeArea ||
      !nonnegative(remainingSafeArea.left) || !nonnegative(remainingSafeArea.right) || remainingSafeArea.bottom !== 0 || remainingSafeArea.left + remainingSafeArea.right >= window.viewport.width) return null;
    const contentBottom = window.viewport.y + Math.max(0, window.viewport.height - Math.max(window.rawImeBottom, dock.height));
    return Object.freeze({ windowIdentity: window.identity, left: window.viewport.x - host.frame.x, width: window.viewport.width,
      bottom: host.frame.y + host.frame.height - contentBottom, viewportHeight: window.viewport.height, safeLeft: remainingSafeArea.left, safeRight: remainingSafeArea.right });
  } catch { return null; }
}
