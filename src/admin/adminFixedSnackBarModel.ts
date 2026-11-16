export type AdminFixedSnackBarNotice = Readonly<{ identity: object; message: string }>;
export type AdminFixedSnackBarEntry = Readonly<{ identity: object; sourceIdentity: object; message: string }>;
export type AdminFixedSnackBarTransition = Readonly<{ identity: object; entry: AdminFixedSnackBarEntry; target: 0 | 1; reset: boolean }>;
export type AdminFixedSnackBarHost = Readonly<{ readonly __adminFixedSnackBarHost: unique symbol }>;
export const adminFixedSnackBarDisplayDuration = 4000, adminFixedSnackBarTransitionDuration = 250, adminFixedSnackBarMovementDuration = 200;
export const adminFixedSnackBarHeightCurve = Object.freeze([.4, 0, .2, 1] as const);
export type AdminFixedSnackBarSwipeMotion = Readonly<{ kind: 'timing' | 'fling' | 'immediate'; target: 0 | 1; from: number; velocity: number }>;
/** Source Dismissible.down ignores a delta that would cross or land exactly at zero. */
export function adminFixedSnackBarDragExtent(extent: number, delta: number): number {
  'worklet'; return extent + delta > 0 ? extent + delta : extent;
}
/** Source .4 threshold is STRICT; native logical-point velocities use700/400 exactly. */
export function adminFixedSnackBarSwipeMotion(extent: number, height: number, velocityX: number, velocityY: number): AdminFixedSnackBarSwipeMotion | null {
  'worklet';
  if (![extent, height, velocityX, velocityY].every(Number.isFinite) || extent < 0 || height <= 0) return null;
  const from = Math.max(0, Math.min(1, extent / height));
  if (from === 1) return { kind: 'immediate', target: 1, from, velocity: 0 };
  if (extent > 0 && Math.abs(velocityY) >= 700 && Math.abs(velocityY) - Math.abs(velocityX) >= 400) return { kind: 'fling', target: velocityY > 0 ? 1 : 0, from, velocity: velocityY / 300 };
  return { kind: 'timing', target: from > .4 ? 1 : 0, from, velocity: 0 };
}
/** Flutter's default critically damped fling (mass1/stiffness500, target beyond bound by.01, infinite velocity tolerance). */
export function adminFixedSnackBarFlingFrame(from: number, target: 0 | 1, velocity: number, seconds: number) {
  'worklet';
  const end = target ? 1.01 : -.01, omega = Math.sqrt(500), a = from - end, b = velocity + omega * a;
  const offset = (a + b * Math.max(0, seconds)) * Math.exp(-omega * Math.max(0, seconds));
  return { value: Math.max(0, Math.min(1, end + offset)), done: Math.abs(offset) < .01 };
}
