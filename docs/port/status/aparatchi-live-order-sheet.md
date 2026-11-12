# Aparatchi live order sheet

Completed on `main`, as requested by the user.

## Source and mapping

V2's `admin_production_map_orders_admin_detail_host.dart` observes `ProductionDataRevision` and reloads current scoped detail while preserving its child and form. `admin_production_map_orders_detail_sync.dart` installs the current action control.

V4's `src/WorkerScreen.tsx` now supplies an explicit queue to its order-detail renderer. The inline iOS sheet receives the current render's queue, including its cursor, apparatus and catalog. Android's update effect receives the same current queue; delayed Android event handlers still read the latest committed queue ref. Order and presentation keys stay stable, allowing the existing detail recovery owner to refresh controls without replacing the open form.

## Verification

- The new iOS cursor regression failed before the fix (incoming revision 8, sheet revision 7); the corresponding Android checks passed.
- 177/177 focused queue, detail recovery, read-only detail, action-state and presentation-retention tests passed after the fix.
- New coverage includes successive immutable live snapshots, server epoch changes, cursor withdrawal/recovery, stable order/sheet identity and delayed Android row callbacks.
- Actual order-view fixtures exercise running → detached → resumed controls on both platforms while retaining an unfinished report and submitting no production command.
- iOS and Android TypeScript projects passed.
- Project lint passed with its existing `AdminClosedHistoryOwner.tsx` dependency warning (0 errors).
- iOS Hermes export passed: `.expo/worker-order-live-cursor-ios`.
- Native views and transport were mocked in lifecycle tests; physical-device verification was not performed.
