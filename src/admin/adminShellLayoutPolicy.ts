import type { AdminSystemInsets } from '../../modules/accord-admin-layout/src/AccordAdminLayoutModule';

export const adminShellHorizontalInset = 6, adminShellCornerRadius = 18, adminShellDockHeight = 60, adminDockGestureInset = 15;
export const adminShellDefaultContentPadding = Object.freeze({ start: 4, top: 0, end: 6, bottom: 0 });
/** @v2 dockLayoutBottomInset */
export function adminDockLayoutBottomInset(metrics: AdminSystemInsets, thinGestureBottom: boolean): number {
  if (thinGestureBottom || (metrics.platform === 'ios' && Math.min(metrics.width, metrics.height) < 600)) return adminDockGestureInset;
  return Math.max(metrics.viewPaddingBottom, metrics.systemGestureInsetsBottom);
}
/** @v2 _contentBottomInset */
export function adminShellBottomReserve(metrics: AdminSystemInsets | null, hasFooter: boolean, thinGestureBottom: boolean, bottomDockHeight = adminShellDockHeight): number | null {
  if (!hasFooter) return 0;
  if (!metrics) return null;
  if (metrics.viewInsetsBottom > 0) return 0;
  return bottomDockHeight + adminDockLayoutBottomInset(metrics, thinGestureBottom);
}
export function adminShellFrameLayout(metrics: AdminSystemInsets | null, hasFooter: boolean, thinGestureBottom: boolean, bottomDockHeight = adminShellDockHeight) {
  return Object.freeze({ horizontalInset: adminShellHorizontalInset, topRadius: adminShellCornerRadius, bottomRadius: hasFooter ? adminShellCornerRadius : 0,
    bottomReserve: adminShellBottomReserve(metrics, hasFooter, thinGestureBottom, bottomDockHeight), dockBottomInset: metrics ? adminDockLayoutBottomInset(metrics, thinGestureBottom) : null });
}
