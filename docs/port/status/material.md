# material

Status: in progress
Stopped at: history surfaces and partial navigation are built in unlinked Material route trees; continue role-neutral operational screens and a fail-closed GScale policy. Main home routing remains intentionally unconnected.

## Open items
| Where | V2 reference | What is needed |
|---|---|---|
| Material history | `material_taminotchi_home_screen_widgets_part_01.dart`, `_MaterialHistoryDetailsSheet` | iOS and Android history and dismissible detail sheets are implemented with session invalidation. Review icon/layout, refresh/back behavior, scope changes, real-device accessibility and full V2 parity before declaring complete. |
| Material home, tasks, sequence, assignment, inventory | `MaterialTaminotchiHomeScreen`, drawer and dock | Only a partial home shell, profile and history drawer entry exist in unlinked role routes; implement all cards, FAB, tasks, supply sequence, assignment and inventory using shared native components and role-neutral APIs. Do not expose the partial home in `homeTargets`. |
| GScale | `gscale_mode_screen.dart`, `OperatorDashboardPage` | Material GScale route remains held. Opt-in `materialPrinterSafety` now guards selection, stop/start, local/remote print stages and archive/reprint boundaries, but must receive independent review and real-hardware verification. Wi-Fi remains blocked; an identified USB/Bluetooth device still needs physical verification. Audit all f119 flows and inherited GScale open items. |
| Chat | shared chat transport | Keep new-role Chat and unread subscription unwired until integrator resolves redirect/cookie security hold. |
| Notifications | shared notification routes and stores | Do not expose held shared notification detail or hidden/unread stores until account-switch holds are resolved. |
| Printer / scale / phone | native channels in role ledger | Verify native builds, permissions, discovery, printing and full flows on physical iOS and Android devices; no simulator, hardware or device used. |
| Test mode | `adminRawMaterialHistory` | Return the V2 demo/test-mode empty history when the later shared test-mode pass is implemented. |
| Error mapping | `_adminProductionMapException` | Shared production map error mapper is incomplete; audit all history non-404 server codes and diagnostics against f119 before parity is claimed. |
| Assignment topology | `productionMapAuthorizedOrderApparatus` | The exact authorized-apparatus filter is available as a role-neutral pure helper, but the rest of production-map chain/WIP behavior is not ported here. Assignment UI must use current account scope and invalidate all in-flight reads and choices on account or permission changes. |
| Assignment list read | `adminRawMaterialAssignments` in `workerRawMaterials.ts` | The protected Worker reader cannot accept a `beforeSend` scope guard without editing Worker code. On a 401 refresh that changes permissions on the same session object it can retry with the changed scope. Do not expose the assignment route until the integrator resolves this boundary without changing protected behavior. |
| Policy integration | `GScaleModeScreen`, `useGScaleScreen` | Policy is opt-in and no route invokes it. Shared picker must catch refused Wi-Fi/Bluetooth selections without closing or unhandled rejection; register operator lifetime/session reset before safe integration. Keep route held pending independent review. |
| USB physical identity | `PrintService.printRps`, `NativeUsbPrinter.printRaw`, Android `UsbPrinterChannel.kt:84-120` | Blocking: JS policy verifies only a previously selected USB profile. Native `printRaw` rediscovers a candidate and compares kind, not device identity. A mocked A→B hot swap reproduces that start/prepare can pass and another Zebra can print. Native atomic device-bound validation plus independent review is required; do not expose Material GScale. |
| Device preferences | `SavedPrintDevice`, `OperatorControlDraft` | Material policy reads legacy choices but uses a session-only overlay to avoid changing other roles’ saved device/draft; durable role-isolated persistence and correct user-facing rejection remain open. |
| Account switch during print | `_printActiveRsBatch`, `reprintArchiveReceipt` | Guards prevent later print/confirm steps after account change, but cannot undo a physical print or prepare request already sent. Define reconciliation and verify on real hardware. |
| Capability mismatch | `AppSession.homeRoute`, `AppRouter.canOpenRoute` | V2 selects material home for `inventory.movement.manage` alone but rejects that route; retain the denial behavior and audit the initial routing edge before home is connected. |
| Remaining tests | `.port/role-material-tests.md` | Re-record any actually used preparation/qolip shared fixture at f119 in coordinated nested stems, and inspect remaining contract/logic/widget cases for reachable tasks, inventory, assignment and GScale; historical top-level recordings are not f119 evidence. |

## Deviations candidates
- The unlinked scanned-assignment command permits an explicit apparatus choice only after the f119-tested HTTP 400 ambiguity response and refuses automatic mutation retries, including after a 401 refresh. V2's screen catches ambiguity regardless of HTTP status; the stricter behavior is a safety hold pending integrator review, not a completed parity claim. A sent request can still have an uncertain outcome and requires state reconciliation.

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

## GScale guard checkpoint (route not wired)
- `gscaleMaterialPolicy.ts` is default-off. The explicit `materialPrinterSafety` runtime option rejects GoDEX, unknown devices and all Wi-Fi, allows only previously observed Zebra USB / XP-P323B Bluetooth selections, requires current session and valid batch metadata for writes, and uses an in-memory overlay so shared preferences cannot be overwritten. Selection is not proof of currently connected physical identity. It is not activated by a route.
- Automatic late-error batch stop, start, print/prepare/confirm, archive print and receipt prepare/print/confirm check the policy at their write boundaries. Focused tests cover session, selection and revision races and the default Preparation behavior. Independent review, printer identity validation, picker error handling and real devices remain required; this is not proof of a deployable route.

## Verification after policy integration
- 112 focused GScale and Material safety tests passed, including no-write on rejected, stale account, scope, device or batch metadata, and default GScale regression cases. Tests use mocks and no live backend.
- iOS TypeScript and Expo lint passed; Android TypeScript reported only the nine inherited Worker errors. Both offline Expo JS exports passed on the current screen checkpoint; they are not native builds.
- Ledger `check` exited 0 (564 tags, 64 test tags) with eight existing dynamic/other-domain endpoint warnings; role report generated, but text gate remains red: iOS 119 V2-only / 51 V4-only strings, Android 118 / 62, plus 33 surfaces to audit. No text exceptions were accepted.
- Source V2 HEAD remains `f11910bb2c8c7081ce26770e69811b03fd0739ed` and original and snapshot Git status are clean. No simulator, real phone, scale, printer or live backend mutation used.

## Independent review follow-up
- A rejected unsupported selection sets `needsAttention` while preserving the old selection. The restricted policy now fails closed for every operation in that state until a valid selection clears it; a mock verifies no start/stop/print/archive/reprint. Default unguarded roles are unchanged.
- `materialGScaleDeviceBindingHold.test.cjs` reproduces the independent review finding: an old selected USB A profile can pass the JS guard and the native boundary can print to newly connected USB B of the same kind. This is a characterization of a blocker, not a passing hardware safety certification. JS preflight followed by native printing is not atomic; no native bridge or protected role behavior was changed.
- 114 focused GScale and policy tests passed after these changes. Material GScale remains unconnected and held for device-bound native enforcement, independent review and real-device tests.

## Shared assignment reader checkpoint
- `src/shared/rawMaterialAssignmentApi.ts` adds role-neutral f119 `adminRawMaterialAssignmentCandidates` and `adminRawMaterialAssignmentDiagnostics`, with canonical apparatus validation, source response models and ordinary non-retrying reads. Existing shared `searchMatches`, `rawMaterialLookupApi`, `rawMaterialUnlinkApi`, `workerRawMaterials` and Preparation assignment API can be reused; no protected files were edited. Assignment UI, command guards, ambiguity selection, QR/manual flows and all other role-neutral screens remain open.
- V2 `test/admin_raw_material_api_test.dart` at f119 uses `HttpOverrides` / a custom HTTP client, outside the existing MockClient recorder hook. Recorder emitted zero requests, so no nested fixture was created or historical recording overwritten. The independent oracle reported 46 passing and two failing cases: `queue action translates production map backend errors` and `test mode completed queue excludes paused work in progress`. The candidate-scope and rejected-roll diagnostic cases passed; their three TS tests assert the source-derived request and model and are not claimed as wire replay. Investigate both V2 failures before using them as specifications.
- Test-mode candidate/diagnostic branches remain for the shared final pass. Shared non-404 production-map error mapping remains incomplete and must be audited before UI parity.

## 401 retry boundary follow-up
- An optional `beforeSend` is now passed through restricted Material GScale batch start, stop, print, client prepare/confirm and stock reprint prepare/confirm into existing `authorizedFetch`, so it rechecks policy and captured session scope before the initial request and any 401 retry. Other callers omit it and retain existing behavior.
- Mocked 401 refresh tests cover role, capability and account changes on seven mutation endpoints, including late-error automatic stop. No second request is sent after a changed scope; a request already sent before the change cannot be retracted. Shared login redirect risk and native USB device-binding blocker remain unresolved, and Material GScale remains held.

## Assignment apparatus topology checkpoint
- `productionMapAuthorizedOrderApparatus` is a role-neutral pure helper based on the f119 reachable-node, condition, shared alternative-operation and exact canonical-ID logic needed by the assignment filter. It does not implement the other V2 chain, WIP, or assignment UI behavior, and has no side effects or route wiring.
- The isolated f119 V2 `production_map_chain_test.dart` oracle passed all 22 tests. An adjacent custom Dart oracle recorded six focused topology inputs and their actual V2 outputs in `tests/contracts/f11910bb/material_assignment_apparatus.json`; the seven TS tests replay those results and check non-mutation and canonical filtering. The custom cases are V2-executed inputs, not existing wire recordings. A role must still bind the helper to its live `assigned_apparatus` and guard account/scope changes before any reads or writes.

## Scoped assignment reads (not yet wired)
- Default-undefined `beforeSend` callbacks are available on the existing order, apparatus catalog, raw-material lookup, candidate and diagnostic readers; they reach `authorizedFetch` before the initial send and a 401 retry. Callback failures are terminal even when they are `TypeError`, rather than triggering a transient-read retry. Default call signatures and behavior remain unchanged.
- Forty focused tests passed, including 401 role, capability, identity and account changes and default-reader regressions. This only supplies a boundary hook: a consumer must supply a sound scope/lifetime guard and invalidate results on account changes. It does not solve same-object/same-scope ABA, the protected assignment list reader, or the shared login redirect hold. No assignment screen or route is exposed.

## Scanned assignment command (not yet wired)
- `RawMaterialAssignmentCommands.assignScanned` reuses the existing Preparation assignment API without modifying it. It permits a second command only following a definite 400 `raw_material_group_ambiguous` and an explicit, offered, canonical apparatus choice. Cancel, invalid choices, account/scope/permission changes, network errors, 5xx, malformed success, concurrent calls, and 401 retries are covered without live writes. After an uncertain sent request this command instance blocks further attempts and exposes `needsReconciliation`; an already-sent command cannot be retracted. The caller must refresh authoritative state before creating a replacement instance.
- A consumer must pass an `isCurrent` guard covering the screen, selected order, scanned code and account lifetime and use the existing QR parser before calling. The command is not wired to UI; manual candidate assignment, unlink, all remaining error messages and the complete controller remain open. Dart and JavaScript stringify nested list/map and some numeric `apparatus_options` differently, so exact malformed-payload presentation is not claimed. The known epoch/ABA issue and protected assignment-list read still block the route.
