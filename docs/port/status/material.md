# material

Status: in progress
Stopped at: history surfaces and partial navigation are built in unlinked Material route trees; continue role-neutral operational screens and a fail-closed GScale policy. Main home routing remains intentionally unconnected.

## Open items
| Where | V2 reference | What is needed |
|---|---|---|
| Material history | `material_taminotchi_home_screen_widgets_part_01.dart`, `_MaterialHistoryDetailsSheet` | iOS and Android history and dismissible detail sheets are implemented with session invalidation. Review icon/layout, refresh/back behavior, scope changes, real-device accessibility and full V2 parity before declaring complete. |
| Material home, tasks, sequence, assignment, inventory | `MaterialTaminotchiHomeScreen`, drawer and dock | Only a partial home shell, profile and history drawer entry exist in unlinked role routes; implement all cards, FAB, tasks, supply sequence, assignment and inventory using shared native components and role-neutral APIs. Do not expose the partial home in `homeTargets`. |
| GScale | `gscale_mode_screen.dart`, `OperatorDashboardPage` | Do not route Material into existing GScale: GoDEX remains selectable/restorable/auto-detected and Wi-Fi printer identity may be unknown. Build and independently review role-scoped fail-closed policy at every write, auto-stop, print and reprint boundary, preserving other roles, then audit all flows and verify real hardware. Existing GScale open items remain. |
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
| `MaterialTaminotchiHistoryScreen`, `_MaterialHistoryDetailsSheet` | `src/material/MaterialHistory.*.tsx` and history logic | partial | partial | Reader, presentation, refresh, retry and dismissible sheet exist. Event icons, visual parity, back/scope changes, dismissal and real-device accessibility still need comparison. |
| `MaterialTaminotchiHomeScreen` | `src/material/MaterialHome.*.tsx` | partial | partial | Scope notice and profile refresh exist; all action cards/FAB and complete dock remain. Routes are not wired to app home. |
| `GScaleModeScreen`, `_MaterialGScaleControlScreen` | `src/gscale/GScaleScreen.*.tsx` | open | open | Material route is held for GoDEX policy, independent review and hardware checks; material shell and f119 flow require comparison. |
| Material drawer / dock / Profile | `MaterialDrawer.tsx`, `MaterialLayout.*.tsx`, `MaterialProfile.*.tsx` | partial | partial | Existing native drawer, dock and Profile reused without `onDailyWork`; unfinished operational routes and held Chat/GScale omitted. |

## Verification at first checkpoint
- Selected V2 `f11910bb2c8c7081ce26770e69811b03fd0739ed`: original and isolated snapshot clean at ledger scan. No commands that write were run in the original V2 checkout.
- The source-derived history API and formatting rules have focused tests; no direct V2 HTTP test of `adminRawMaterialHistory` was found. The delivery event model test follows V2 `test/admin_production_map_material_delivery_test_part.dart`.
- `order_scan_bootstrap_api_test.dart` recorded 16 requests / 13 recording cases into the isolated `tests/contracts/f11910bb/` namespace. Independent V2 oracle: 116 tests passed. Two material-specific recorded request paths replayed.
- iOS TypeScript passed after replacing the freshly generated incomplete worktree route types with the known-good generated local route types. No device or simulator used.

- History lifecycle tests cover racing refreshes, independent apparatus catalog loading/failure and in-flight account changes; screen and native-sheet behavior still needs verification.

## Verification at screen checkpoint
- `node --test tests/*.test.cjs`: 1,201 passed, six inherited Preparation Android tests fail due to Expo UI ESM resolution; no Material test failed.
- iOS typecheck and Expo lint passed. Android typecheck reports only the nine existing Worker errors; no Material errors.
- Expo SDK 58 versioned documentation and installed UI types were checked. No simulator or phone used.
- Material route trees are present but no `homeTargets` entry was added. No Chat, unread, notification detail or GScale route was exposed.
