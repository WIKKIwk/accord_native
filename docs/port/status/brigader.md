# Brigader

Status: in progress — not a completed role.
Branch: `port/brigader`, isolated worktree `accord_mobile_v4-brigader`, based on main `b6aee7b9`.
Source: baseline `f11910bb2c8c7081ce26770e69811b03fd0739ed`; Brigader core is unchanged at current V2 `052655a4`.
Scope: Brigader only; the ledger combines Sales Manager with this id, but Sales Manager is outside this request.

## Checkpoint: saved calculation contracts and state

Added the three missing shared APIs `calculateOrderTemplates`, `upsertCalculateOrderTemplate`,
`deleteCalculateOrderTemplate`, reusing the existing opened-order template representation.
The shared serializer preserves optional fields, effective legacy layers, Dart text/date handling and UTC microseconds.
`CalculateOrderTemplateStore` preserves source scope/generation, archive singleflight, first-code/id dedupe,
mutation replay over a late archive, reset and disposal. The optional request guard reuses existing authorizedFetch.

Validation: 14 focused source-derived tests passed. These are not recorded V2 HTTP fixtures.
Source references: `core/api/calculate/mobile_api_calculate_models_part_01.dart`,
`features/admin/state/calculate_order_store.dart`, `core/api/calculate/mobile_api_calculate_declarations_part_03.dart`.

## Open items

| Where | V2 reference | Required result |
|---|---|---|
| Complete Brigader scope | `AppRouter.canOpenRoute`, `test/brigader_role_test.dart` | All 47 allowed routes, 17 source Home actions (or four summary shortcuts), 16 drawer entries, four dock entries and five Create actions must have real compositions. The existing Admin dependency is partial; do not mark this complete by counting tags or hiding unavailable entries. |
| Shared Admin source presentation | `AdminDock`, `showAdminCreateHubSheet`, `AdminUsersScreen`, shared root/sheet callers | Complete the original source-root/FAB/Users/Create and owned feature compositions. Existing held components are not exposed as fake pages. |
| Work Map | `AdminProductionMapOrdersScreen` and its details/Closed/Move controls | Existing reused view remains partial; full action/detail/closed-history/drag and source surface audit remain required. |
| Profile Settings/PIN | V2 Profile and SecurityController | Original owner guarding through delayed PIN storage is being completed; do not enable unguarded settings callbacks. |
| Inventory | `InventoryMovementsScreen`, InventoryViewStore | Complete guarded snapshot/lookup/relocation and native live endpoint; do not impersonate preparation or inject inventory capabilities. |
| Source text gate | `.port/text-brigader.md` | Gate includes transitive Admin files and Sales Manager. Audit each real Brigader surface; no blanket acceptance rows are added. |
| Physical native acceptance | Android/iOS shell, dialogs, keyboard, native live, PIN, camera/printer paths | Real phones/development binaries are required; no device or simulator used. |

## Surface audit

| V2 surface and location | V4 file | iOS | Android | What differs |
|---|---|---|---|---|
| AdminHomeScreen | `src/brigader/BrigaderHomeRoute.*.tsx`, reused `AdminHomeScreen.*` | partial | partial | Source title/store/summary/return refresh reused; unavailable Admin actions remain missing. |
| AdminNavigationDrawer | shared `AdminDrawer`, Brigader namespace | partial | partial | Actual Brigader stack and source planner; missing Admin destinations not claimed as ported. |
| AdminDock | native Brigader tabs / BrigaderBottomBar | partial | partial | Source Home/Activity ready; Users/Create source dependencies remain open. |

## Deviations candidates

None introduced as product decisions. Missing shared dependencies are incomplete work, not accepted deviations.

## Test mode pending

Shared V2 test mode remains deferred under project D3. A legacy `test-mode-token` cannot enter a live Brigader workspace.

## Source coverage and test limits

The role ledger estimates 65k source tokens; this is not a measurement of tokens read.
V2 is read-only. No production backend calls, simulator or physical device used.
Main and the user's existing uncommitted work are untouched.
