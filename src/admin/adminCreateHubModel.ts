import type { Session } from '../auth';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { adminDefaultCreateActions, adminDockDestinations, type AdminCreateAction } from './adminDockModel';

export const adminCreateHubGeometry = Object.freeze({ dockHeight: 60, fabSize: 80, openFabSize: 56, fabRadius: 22,
  fabGap: 44, fabLift: 10, trailing: 16, actionHeight: 56, actionGap: 4, actionPadding: 14, iconSize: 24, iconGap: 10, actionsGap: 10 });

/** Keep source-visible destinations intact. An unavailable real page holds the owner instead of silently omitting a row. */
export function adminCreateHubPlan(session: Session, locale: string, available: (route: string) => boolean) {
  const actions = Object.freeze(adminDefaultCreateActions(session, locale).map(action => Object.freeze(action)));
  const hasPrimary = adminDockDestinations(session, locale).some(item => item.primary);
  const missingRoutes = Object.freeze(hasPrimary ? actions.filter(action => !isSynchronouslyTrue(() => available(action.routeName))).map(action => action.routeName) : []);
  return Object.freeze({ actions, hasPrimary, missingRoutes, ready: missingRoutes.length === 0 });
}

/** @v2 appNavigationBarPrimaryButtonBottom */
export function adminCreateHubLayout(dockBottomInset: number | null, hasPrimary: boolean, primaryVisible: boolean) {
  if (dockBottomInset === null) return Object.freeze({ dockHeight: null, hostHeight: null, toggleBottom: null, actionsBottom: null });
  const g = adminCreateHubGeometry, dockHeight = g.dockHeight + dockBottomInset;
  const toggleBottom = dockHeight + g.fabGap - g.fabSize / 2 + g.fabLift;
  return Object.freeze({ dockHeight, hostHeight: dockHeight + (hasPrimary && primaryVisible ? g.fabSize + g.fabGap : 0),
    toggleBottom, actionsBottom: toggleBottom + g.fabSize + g.actionsGap });
}

export function adminHubSpatial(value: number) { 'worklet'; return Math.max(-.06, Math.min(1.18, value)); }
export function adminHubSpringScale(value: number) {
  'worklet'; const clamped = Math.max(0, Math.min(1.14, value)); return clamped <= 1 ? .86 + .14 * clamped : 1 + (clamped - 1) * .18;
}
/** Flutter Curves.easeOutCubic: Cubic(.215,.61,.355,1), using its .001 x-error bound. */
export function adminHubEaseOutCubic(t: number) {
  'worklet'; if (!(t > 0)) return 0; if (t >= 1) return 1;
  const evaluate = (a: number, b: number, m: number) => 3 * a * (1 - m) * (1 - m) * m + 3 * b * (1 - m) * m * m + m * m * m;
  let start = 0, end = 1;
  for (let count = 0; count < 32; count++) {
    const mid = (start + end) / 2, estimate = evaluate(.215, .355, mid);
    if (Math.abs(t - estimate) < .001) return evaluate(.61, 1, mid);
    if (estimate < t) start = mid; else end = mid;
  }
  return evaluate(.61, 1, (start + end) / 2);
}
/** @v2 _hubStaggerSpatialT */
export function adminHubStaggerSpatial(value: number, order: number) {
  'worklet'; const start = Math.max(0, Math.min(.76, order * .2)), end = Math.max(0, Math.min(1, start + .56));
  if (value <= start) return 0; const span = end - start; if (span <= 0) return 1;
  const grow = span * .86, bounce = span - grow;
  if (value < start + grow) { const t = Math.max(0, Math.min(1, (value - start) / grow)); return adminHubEaseOutCubic(t); }
  return value <= end && bounce > .000001 ? 1 + .055 * Math.sin(Math.PI * ((value - start - grow) / bounce)) : 1;
}
export function adminHubStaggerOpacity(value: number, order: number) {
  'worklet'; const start = Math.max(0, Math.min(.76, order * .2)), end = Math.max(0, Math.min(1, start + .56));
  // Source uses animateWith for closing too; Flutter reports forward status, so
  // CurvedAnimation keeps the forward curve despite its declared reverseCurve.
  return adminHubEaseOutCubic(Math.max(0, Math.min(1, (value - start) / (end - start))));
}
export type AdminCreateHubDefaultAction = Readonly<AdminCreateAction>;
