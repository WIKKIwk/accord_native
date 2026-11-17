import type { AdminSystemInsets } from '../../modules/accord-admin-layout/src/AccordAdminLayoutModule';
import type { AdminCreateHubController } from './adminCreateHubController';
import { adminCreateHubLayout } from './adminCreateHubModel';
import { adminDockLayoutBottomInset } from './adminShellLayoutPolicy';

export type AdminSourceDockPrimary = NonNullable<ReturnType<AdminCreateHubController['primaryFor']>>;
const nonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
/** @v2 AppNavigationBar.build
 * A sizing target only. Even an exact Source target is never a native dock measurement. */
export function adminSourceDockSizing(metrics: AdminSystemInsets | null, thinGestureBottom: boolean | null, primary: AdminSourceDockPrimary | null) {
  if (!metrics || !primary || typeof thinGestureBottom !== 'boolean' || !['android', 'ios'].includes(metrics.platform) ||
    ![metrics.width, metrics.height].every(value => nonnegative(value) && value > 0) || ![metrics.viewPaddingBottom, metrics.systemGestureInsetsBottom, metrics.viewInsetsBottom].every(nonnegative)) return null;
  const dockBottomInset = adminDockLayoutBottomInset(metrics, thinGestureBottom);
  const layout = adminCreateHubLayout(dockBottomInset, primary.hasPrimary, primary.visible);
  if (layout.dockHeight === null || layout.hostHeight === null || layout.toggleBottom === null || layout.actionsBottom === null) return null;
  return Object.freeze({ dockHeight: layout.dockHeight, hostHeight: layout.hostHeight, toggleBottom: layout.toggleBottom, actionsBottom: layout.actionsBottom, dockBottomInset });
}
export type AdminSourceDockSizing = NonNullable<ReturnType<typeof adminSourceDockSizing>>;
/** Flutter _ScaffoldLayout.performLayout, extendBody:true. AppShell's independent content reserve is untouched. */
export function adminSourceDockBodyBottom(metrics: AdminSystemInsets | null, measuredDockHeight: number | null): number | null {
  if (!metrics || !nonnegative(metrics.viewInsetsBottom) || !nonnegative(measuredDockHeight)) return null;
  return metrics.viewInsetsBottom > measuredDockHeight ? metrics.viewInsetsBottom : 0;
}
