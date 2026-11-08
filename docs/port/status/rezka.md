# rezka

Status: parts 1–4 in progress; not ready to merge or declare done.
Stopped at: master settings screens and split API/rules prepared with session/scope guards. Implement and audit the remaining split surfaces, then connect only reviewed, safe destinations.

V2 source: `f11910bb2c8c7081ce26770e69811b03fd0739ed`. The original checkout was clean at session start and remained read-only. The ledger's drift result is relative to this pin and does not prove historical drift parity. Each ledger part was generated against an isolated clean clone. Text gate initially reported 407 iOS and 406 Android V2 strings absent and 43 iOS and 54 Android extra strings; its wide shared-worker/admin reach requires a manual reachability audit, not blanket exceptions.

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| Scope and routing | `app_router_AppRouter_resplit_class_AppRouter_resplit2_static_methods_02.dart:28–37`, `app_router_AppRouter_resplit_class_AppRouter_resplit2_static__routeCapabilities.dart:87` | Rezka master must have `rezka.master.access` and is limited to the seven routes in that allowlist; `rezkaSplit` is not one of them. Other eligible users can open `rezkaSplit` with `rezka.split.manage`. Port split separately, never add it to the master drawer. |
| Existing worker entry and Chat | V4 `src/shared/appRoutes.ts:661,706–707`, `src/app/index.tsx:33–34`, `src/app/ios-worker/_layout.tsx:51–63`, `src/components/WorkerBottomBar.android.tsx:4–7`, `src/WorkerScreen.tsx:198–205` | This mapping and Chat exposure already exist on main: a Rezka master with the capability enters iOS worker tabs or Android WorkerScreen, whose Chat is reachable. Shared Chat's redirect/cookie risks are under review. Do not add another role Chat route, socket or badge; do not alter the excluded worker files. A safe Rezka shell and reviewed real destinations are needed before further routing. New master API calls capture and check session, role and scope on initial send and any 401 retry; `rezkaMasterSavePrintSideGuarded` applies the same rule through the optional callback on the legacy print-side API without changing its default callers; an in-flight mutation after a scope change remains an uncertain outcome. |
| Master queue and order sheets | `admin_production_map_orders_helpers.dart:3–45`, `admin_production_map_orders_rezka_frame_print.dart` and the worker order sheets | Reuse the existing worker workspace. Compare all Rezka-specific editing, print-side, output, remainder, paddon and permission states against the selected baseline. Wiring settings into the protected worker/order implementation requires a separately authorized integration. The shared queue's historical drift and existing differences are not fixed here. |
| Worker settings UI | `admin_worker_settings_screen.dart:62–96`, `_methods_01.dart:42–185`, `_methods_02.dart:145–220`, `widgets_part_06.dart` | Assignment controller and unconnected iOS/Android screens implement master worker loading, expandable detail, apparatus picker, conflicts and no-write-on-unchanged rule. Reuse the existing shell footer; route integration remains blocked pending session lifecycle review and phone validation. Load both master workers and apparatus (limit 500); no identity edit/delete; require a selection; preserve saved assignment conflicts and blocked open-run message. Connect only once the safe role shell exists. |
| Additional settings | `admin_additional_settings_screen.dart`; `admin_worker_settings_screen.dart:85–96` | Shared Additional Settings including Rezka Paddon-only permissions is owned by the admin session. Integrate its reviewed real component through the shared Aparatchi dock, activeTab null and no primary FAB, once available. |
| Split feature | `features/rezka/presentation/rezka_split_screen*.dart` and `core/api/rezka/mobile_api_rezka.dart` | Source/split API and draft/quantity/barcode rules are implemented and source-oracle tested. Every new split mutation is checked against its captured session, role and scope before both initial transmission and any 401 retry; a scope change after transmission is an uncertain outcome and must not be retried automatically. Implement both real platform flows with capability guard; shared printer-picker extraction is under review. Do not duplicate it, invent printer results, use GoDEX, or wire an unsafe scanner/printing path. |
| Shared navigation and destinations | `aparatchi_navigation_drawer.dart`, `aparatchi_dock.dart` | Master needs existing native drawer/dock reused with master worker/additional settings, daily work, assigned Paddon destinations and profile. Existing worker drawer omits settings and worker FAB currently shows unavailable Paddons. Do not fake missing destinations or edit Worker components. |
| API and source tests | `.port/role-rezka-tests.md`, `.port/role-rezka-{1,2,3,4}.md` | Remaining relevant API/logic and widget assertions need case-by-case scope checks, source-aware recordings or explicit reasons; old fixtures predate the selected baseline. Selected-source `rezka_master_role_test` is recorded. V2 has no direct split test, so `tests/v2_oracles/rezka_split_oracle_test.dart` exercises its source in a temporary export, with its four mock requests recorded at the same baseline and replayed by V4. |
| Hardware and app runtime | Native Bluetooth/USB printing, camera, account switching, native sheets | No simulator, emulator or real phone was used. Native builds and hardware workflows remain unverified. |

## Surface audit

| V2 surface and location | V4 file | iOS | Android | What differs |
|---|---|---|---|---|
| `AdminProductionMapOrdersScreen` worker mode and master options | existing `WorkerScreen.tsx`, `OrderScreen.tsx` | open | open | Existing shared workspace is reused, but master options, current V2 drift and full role behavior have not been verified; these files are protected from edits. |
| `AdminWorkerSettingsScreen` master branch | `src/rezka/RezkaWorkerSettings.ios.tsx`, `.android.tsx` | partial | partial | Real views, load/picker/error flows and shared shell inputs exist, but are unconnected; account scope ABA, native sheet/back and phone behavior remain unverified. |
| `AdminAdditionalSettingsScreen` master branch | pending shared component | open | open | Admin session owns shared Paddon-only view. |
| `RezkaSplitScreen`, item picker and scanner | pending | open | open | Capability-scoped non-master surface still to port. |
| Shared daily, Paddon, instructions, profile and Chat surfaces | existing or pending | open | open | Reachable states and destinations need explicit comparison; no new Chat wiring until security review. |

## Deviations candidates

None decided. Existing V2 behavior remains the specification.

## Test mode pending

The master API and split APIs have no separate test-mode handling added in this session; test mode is a project-wide deferred pass.

## Needs from the integrator

- Reconcile existing master-to-worker Chat exposure and shared authentication/Chat risks without changing protected worker/preparation files in this session.
- Supply reviewed shared Additional Settings and printer-picker components; connect only their real supported paths.
- Integrate master-only controls into the protected existing order sheets if source comparison confirms they are absent.

Session lifecycle note: the new controller must be invalidated on account reset and its screen remounted on any read-scope change. The current shared auth refresh can mutate the same Session object when capabilities or assignments change, without an identity-reset notification. Until a reliable scope-change signal or safe remount exists, do not wire the screen; stale results and old-scope writes are rejected, but stale presentation also needs clearing.

The parent reported `activeSessionEpoch(session)` in main at `34e3765`; it is not present in this branch and no merge/rebase was performed. On integration, compare its epoch alongside the captured identity/scope. This helps distinguish operations begun before a login attempt, but does not solve same-epoch `saveSession` ABA, snapshots taken after login began, or absent scope-change events. Keep routes disconnected until these are resolved.
