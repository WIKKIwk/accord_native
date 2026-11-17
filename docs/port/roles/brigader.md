# Brigader V2 → V4 contract

Source: V2 baseline `f11910bb2c8c7081ce26770e69811b03fd0739ed`; current checkout `052655a4`.
Brigader route allowlist, Home, Dock, Drawer, and Create action definitions have no drift between these commits.
Shared Users/Worker Metalayzer additions already in V4 are inherited, not new Brigader features.
This contract covers `brigader`, not the ledger's combined `sales_manager` entry.

## Authority

`AppSession.homeRoute`: role `brigader` plus `brigader.access` selects Brigader Home before generic Admin access.
`AppRouter.canOpenRoute`: the 47-route allowlist is authoritative; stale `admin.access` cannot reopen omitted routes.
Keep original session/witness on every screen, HTTP attempt and result; remount after account/role/grant transitions.
Do not manufacture Admin identity or add capabilities. V2 API contracts remain shared.

## Home — AdminHomeScreen

Source `features/admin/presentation/admin_home_screen.dart:20`.
Title `Brigader`. With `party.supplier.read`, request Admin summary after first frame, show initial loading,
retry on initial error, then four shortcuts: Factory Map, saved calculations, calculate, Work Map.
Without that capability, show the 17 allowed inherited action rows immediately; summary is not fetched.
Source ordering/text comes from the existing `adminHomeModel.ts`, including all four supported languages.
Refresh on admin-topic push, explicit pull, and actual return from an opened child. Reject duplicate opens.
Use existing `AdminHomeScreen.*`, `AdminHomeController`, `AdminStore`, summary reader and refresh hub.
Readiness filtering is an explicit partial implementation; it does not establish parity for absent destinations.

## Navigation

Source drawer `widgets/admin_navigation_drawer.dart`: 16 allowed entries in source order: Home, Users,
Products, Work Map, Opening WIP, WIP, Notifications, Equipment, Additional Settings, Warehouses, Locations,
Raw Material Settings, Microns, Worker Settings, Product Groups, Profile. Profile pushes; other routes reuse
the source-aware push/replace/pop-to planner. Drawer delay is 220ms; logout prompt delay is 120ms.
Use `AdminDrawer` and its existing navigation planner with the Brigader namespace.

Source dock `widgets/admin_dock.dart`: Home, User, Create, Activity. Create opens five source actions:
user creation, item creation, progress QR, saved calculations, calculate order. No substitute destinations.
Missing Users/Create integration stays an explicit Open item, never a fake control.

## Ready shared compositions

Both native route trees reuse Home, Activity, Profile, Factory Locations, Item Groups,
Additional Settings, Queue Policies, Inactive Users, Inventory and Work Map. Child route admission rechecks the original workspace owner.
Activity reuses the real hidden-notification store and guarded clear confirmation. Locations and Item Groups
retain their native dialogs, pickers and write guards. Additional Settings preserves V2 operator-vs-management
branches; Brigader is management. Work Map inherits existing shared partial detail/Closed/Move behavior;
it is not marked fully ported. Profile Settings/PIN is enabled with optional original-session guards through persistence;
logout clears source security state using the existing before-clear-session hook.
Android reuses Material/worker list, button, filters and drawer/dock; iOS uses native SwiftUI and native navigation.
Back at a direct child entry returns to Brigader Home. Saving/dismissal guards remain those of shared controllers.

## Complete source route inventory

The exact 47 routes from `app_router_AppRouter_resplit_class_AppRouter_resplit2_static_methods_02.dart:46`:

```
/brigader-home /admin-home /admin-factory-map /admin-calculate-orders /admin-calculate
/admin-production-map-test /admin-production-map-orders /admin-suppliers /admin-activity
/admin-item-bulk-move /admin-opening-wip /admin-wip-batches /admin-notifications
/admin-apparatus-settings /admin-apparatus-groups /admin-additional-settings /admin-warehouses
/admin-factory-locations /admin-raw-material-settings /admin-raw-material-rules
/admin-raw-material-assignments /admin-calculate-materials /admin-worker-settings
/admin-item-group-create /admin-create-hub /admin-user-create /admin-supplier-create
/admin-customer-create /admin-customer-detail /admin-worker-detail /admin-worker-profile-detail
/admin-inactive-suppliers /admin-item-create /admin-item-detail /admin-supplier-detail
/admin-supplier-items-view /admin-supplier-items-add /admin-werka /admin-queue-policies
/admin-apparatus-create /admin-progress-qr-scan /apparatus-queue /apparatus-work-instructions
/apparatus-daily-work /apparatus-paddons /apparatus-paddon-detail /inventory-movements
```

Always-open shared source routes include profile, Chat and PIN; these still require an actual native owner.
Remaining shared Admin/Chat/PIN compositions are tracked individually in the session status.
