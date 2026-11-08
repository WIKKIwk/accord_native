# material

Status: in progress
Stopped at: material history API, display rules and account-safe lifecycle; implement both platform surfaces and role routing, then audit reachable GScale and shared destinations.

## Open items
| Where | V2 reference | What is needed |
|---|---|---|
| Material history | `material_taminotchi_home_screen_widgets_part_01.dart`, `_MaterialHistoryDetailsSheet` | Connect tested source-derived reader and presentation to both native screens, history sheet, navigation and session-safe lifecycle. |
| Material home, tasks, sequence, assignment, inventory | `MaterialTaminotchiHomeScreen`, drawer and dock | Implement and audit reachable routes using existing native components and shared feature implementations. Leave unavailable actions unwired rather than fake them. |
| GScale | `gscale_mode_screen.dart`, `OperatorDashboardPage` | Audit material-specific control/order flow, drawer/dock, all dialogs and text against f119 on both platforms. Existing shared GScale has open parity and hardware items in `status/gscale.md`. |
| Chat | shared chat transport | Keep new-role Chat and unread subscription unwired until integrator resolves redirect/cookie security hold. |
| Notifications | shared notification routes and stores | Do not expose held shared notification detail or hidden/unread stores until account-switch holds are resolved. |
| Printer / scale / phone | native channels in role ledger | Verify native builds, permissions, discovery, printing and full flows on physical iOS and Android devices; no simulator, hardware or device used. |
| Test mode | `adminRawMaterialHistory` | Return the V2 demo/test-mode empty history when the later shared test-mode pass is implemented. |
| Error mapping | `_adminProductionMapException` | Shared production map error mapper is incomplete; audit all history non-404 server codes and diagnostics against f119 before parity is claimed. |

## Deviations candidates
None identified yet.

## Test mode pending
History returns an empty list in V2 test mode; shared test mode is intentionally deferred.

## Needs from the integrator
The scoped `order_scan_bootstrap_api_test` f119 fixture is owned by this branch; other roles should not write its nested path.

## Surface audit
| V2 surface and location | V4 file | iOS | Android | What differs |
|---|---|---|---|---|
| `MaterialTaminotchiHistoryScreen`, `_MaterialHistoryDetailsSheet` | `src/material/materialHistoryApi.ts`, `materialHistoryPresentation.ts` | open | open | Logic started; screens and action parity remain. |
| `MaterialTaminotchiHomeScreen` | not yet wired | open | open | Cards, FAB, navigation and scope notice remain. |
| `GScaleModeScreen`, `_MaterialGScaleControlScreen` | `src/gscale/GScaleScreen.*.tsx` | open | open | Material shell and f119 flow require comparison; inherited GScale open items remain. |

## Verification at first checkpoint
- Selected V2 `f11910bb2c8c7081ce26770e69811b03fd0739ed`: original and isolated snapshot clean at ledger scan. No commands that write were run in the original V2 checkout.
- The source-derived history API and formatting rules have focused tests; no direct V2 HTTP test of `adminRawMaterialHistory` was found. The delivery event model test follows V2 `test/admin_production_map_material_delivery_test_part.dart`.
- `order_scan_bootstrap_api_test.dart` recorded 16 requests / 13 recording cases into the isolated `tests/contracts/f11910bb/` namespace. Independent V2 oracle: 116 tests passed. Two material-specific recorded request paths replayed.
- iOS TypeScript passed after replacing the freshly generated incomplete worktree route types with the known-good generated local route types. No device or simulator used.

- History lifecycle tests cover racing refreshes, independent apparatus catalog loading/failure and in-flight account changes; screen and native-sheet behavior still needs verification.
