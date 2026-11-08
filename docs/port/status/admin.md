# admin

Status: part 1 of 8 in progress
Stopped at: Continue part 1's remaining API families and their V2 tests, then write the full UI contract, implement and wire every reachable admin surface on both platforms, run all gates and finish the surface-by-surface audit. Nothing in this checkpoint makes the Admin role runnable or complete.

The source used for the new work is `f11910bb2c8c7081ce26770e69811b03fd0739ed`. An isolated clean clone was used for ledger and oracle reads. The original source and the clone were both clean at that SHA before and after those operations. The ledger reports 8 parts, 275 public API entries (including already-tagged imports) and 112 surface entries; runtime reachability and existing tags still require review. The historical 61 top-level contract files are from `7c87a54e` and were not overwritten.

## Checkpoint: item groups and item paging

- `src/admin/itemGroupApi.ts` ports the live paths of `adminItemGroups`, `adminItemGroupTree`, `adminCreateItemGroup`, `adminMoveItemGroupParent`, `adminMoveItemsToGroup`, `adminItemUoms` and `adminItems`. The last reuses the existing `adminItemsPage` reader. `itemGroupModel.ts` implements the group/result parsers and the customer-ancestry rule.
- Independently ran V2 `test/admin_item_group_customer_policy_test.dart` in an exported f119 oracle: 2 passed. The matching V4 rule is covered by `tests/adminItemGroup.test.cjs` along with source-derived mocked request/parser tests; 6 tests passed. No V2 HTTP recording was found for these operations, so the tests are not f119 recorded-wire replays.
- iOS TypeScript passes after regenerating the ignored `.expo/types/router.d.ts` using Expo's installed route generator. The worktree script copied stale route types lacking the existing `/sheet/[id]` route, which initially caused an unrelated `src/nativeSheet.tsx` type error. No tracked routing or TypeScript configuration was changed.
- Text gate before implementation: iOS 1,172 V2 strings absent / 62 native extras; Android 1,170 absent / 73 extras. These are scanner results, not audited differences: matching the broad admin ledger also sweeps shared and other-role surfaces, while dynamically assembled and localized strings can be missed. No exceptions were accepted. Every relevant V2 screen and dialog still needs side-by-side review rather than using counts as proof.

## Checkpoint: factory locations

- `src/admin/factoryLocationApi.ts` ports the live paths of `adminFactoryLocations`, `adminCreateFactoryLocation`, `adminUpdateFactoryLocation` and `adminReplaceFactoryLocationApparatus`, including local validation, normalization and V2 error messages. `factoryLocationModel.ts` handles compact backend apparatus snapshots and reuses the existing full canonical apparatus reader.
- Ran the complete V2 `test/admin_factory_locations_test.dart` independently in the f119 oracle: 6 passed. Its replacement and duplicate-name cases exercise V2 test mode; they are not proof that V4 test mode has been ported. Six source-derived V4 tests passed for live-path requests, parsing, guards and errors, and iOS typecheck passed. No suitable V2 HTTP recording was found for these four methods.

## Checkpoint: server monitor reads and backup start

- `serverMonitorModel.ts` ports report, backup, runtime and live-event parsers, including Dart-style rounding and pong latency. `serverMonitorApi.ts` ports the live `adminServerMonitor`, `adminStartBackup` and `adminServerMonitorLiveUri`; no backup request was sent to a backend. The item-group and monitor models share one Dart-style JSON string helper.
- The f119 oracle ran all 6 cases of `test/admin_server_monitor_api_test.dart` successfully. Three use V2 test mode, one uses a custom recording `BaseClient` for streamed import, and two cover timeout/pong logic. A scratch recorder run produced zero wire records because that client is not the instrumented `MockClient`; it is not a contract replay. Five source-derived V4 tests and iOS typecheck passed.

## Checkpoint: admin settings model and API

- `adminSettings.ts` ports `AdminSettings.fromJson` / `toJson`, `adminSettings` and `updateAdminSettings`; every V2 field is sent on update and the model's strict types and null defaults are preserved. Tests used mocked placeholder values only; no settings request was sent to a server.
- The full f119 `test/test_mode_demo_data_test.dart` passed 9/9 in the isolated oracle, including a demo settings read. V4's test mode remains pending, so that result does not establish V4 test-mode parity. Two source-derived V4 API/model tests and iOS typecheck passed; no f119 HTTP recording for these methods was found.
- Interim full gates after the preceding checkpoint: lint passed; Android typecheck reports 9 existing errors in protected worker components and no errors in these admin files; Node suite passed 1,182 / 1,188, with the six inherited preparation tests failing while resolving the Expo UI ESM import.

## Checkpoint: server monitor live events

- `serverMonitorLive.ts` opens the V2 live URI, sends the initial and two-second JSON pings, parses report/pong messages, applies the seven-second silence watchdog and closes on cancellation or failure. Four deterministic mock-socket tests and iOS typecheck passed; no socket was opened against a backend or device.
- The subscription now supports nested pause/resume, optional resume signals, buffered event order and paused watchdogs, with 6 mock-socket tests. The standard RN WebSocket does not expose V2's native 25-second control-frame ping. It has not been exercised on a phone; compare native buffering and reconnect behavior before marking this stream fully equivalent.

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| Entire role | `.port/role-admin-1.md` through `.port/role-admin-8.md` generated at f119 | Complete remaining unchecked methods, models, contracts, logic tests, all reachable screens, sheets, navigation and UI contract. Existing `[x]` tags are imports, not f119 parity evidence. |
| V2 drift | `docs/port/status/baseline-sync.md` | Compare role-relevant `7c87a54e..f11910bb` changes, including dependencies already tagged in V4. A zero drift report against the new pin does not establish that historical drift was re-ported. |
| Recorded contracts | `.port/role-admin-tests.md` | Run each relevant V2 test independently first; record successful f119 cases into distinct nested fixtures, never overwrite the historical top-level files, and port the replays. Coordinate shared stems. Do not run a live-backend mutation. |
| Item groups and paging | `mobile_api_admin_item_groups.dart`, `mobile_api_admin_items_MobileApiAdminItems_methods_01.dart`, `mobile_api_admin_items_MobileApiAdminItems_methods_04.dart` | No direct V2 HTTP recording was found for the seven checkpoint methods. Source-derived tests cover their requests; add a real f119 recording if a suitable V2 mock test is found. |
| Admin settings | `adminSettings`, `updateAdminSettings`, `AdminSettings` | Live source-derived API and model tests exist but no recorded f119 HTTP replay was found. Settings screen, capability guards, saved/loading/error states and demo branch are still unported. |
| Server monitor | `mobile_api_admin_settings_monitor_declarations_part_02.dart`, `warehouse_live_client_io.dart`, `admin_server_monitor_screen_*` | Live JSON ping, watchdog, pause/resume and connection timeout have mock tests, but native event buffering and transport-level 25-second ping remain open. Backup import and download streams, UI/retry lifecycle and test mode are not ported; native streaming and real-phone behavior need verification. The independent oracle passed, but the recorder produced zero records for its custom client. |
| Factory locations | `test/admin_factory_locations_test.dart`, `admin_factory_locations_screen.dart` | The live API/model has source-derived tests but no recorded f119 HTTP replay. V2 test-mode mutation behavior and the screen, editor dialog, apparatus picker and route remain unported. |
| JSON value fidelity | `adminItemGroups`, `AdminItemGroupBulkMoveResult.fromJson` | Dart distinguishes integer-valued double JSON tokens and exact large integers; standard `JSON.parse` does not. Group-name conversion and count parsing therefore differ on those unusual non-string/non-integer payloads. A lossless parser needs evaluation; do not silently mark full parser parity. |
| Existing `adminItemsPage` | `SupplierItem.fromJson` in `app_models_declarations_part_01.dart` | The imported reader parses ordinary catalog payloads. Its JS stringification of nested `order_apparatus_options` / `customer_names` values differs from Dart collection `toString()`; compare nonstandard values and resolve without rewriting the shared reader independently. |
| Admin production queue | `AdminProductionMapOrdersScreen(workerMode: false)` and other admin-only branches | Existing worker queue code covers worker mode, not proof of admin parity. Do not modify protected worker or preparation files; record the specific shared switches and request an integrator change if required. |
| UI/text and platform checks | `.port/role-admin.md`, `.port/text-admin.md` | No Admin surface has been implemented or audited in this checkpoint. Build and verify all reachable surfaces, including the complete sheet/dialog/back-guard inventory. Run text gate, both platform typechecks, lint and Node tests; devices, simulators and emulators were not used. |
| Large responses | `json_payload_decoder.dart` | V2 decodes JSON >=128K code units in a background isolate. The existing JS path is synchronous; measure on a real admin payload and review the user-visible performance consequence. |

## Deviations candidates

None identified in this checkpoint.

## Test mode pending

| V4 function | V2 symbol |
|---|---|
| `adminItemGroups`, `adminItemGroupTree`, `adminItemUoms`, `adminItems` | Their namesakes read or derive test-mode demo data; this shared mode is deferred and has not been added to the live-path functions. |
| `adminFactoryLocations`, `adminCreateFactoryLocation`, `adminUpdateFactoryLocation`, `adminReplaceFactoryLocationApparatus` | Their namesakes read or mutate the in-memory factory-location catalog in test mode, including duplicate-name and apparatus membership checks. |
| `adminServerMonitor`, `adminStartBackup`, `adminServerMonitorLiveEvents` | V2 reads and updates in-memory demo backup data, and completes the live event stream without opening a socket, in test mode. |
| `adminSettings` | V2 returns demo admin settings in test mode. |

## Needs from the integrator

- Integrate other role branches and shared navigation only after reviewing conflicts and role guards. The Admin home and routes are not wired by this checkpoint.
- Preserve the protected worker and preparation code. Admin's separate branches of shared production queue surfaces still require a reviewed integration plan.

## Surface audit

No surface is marked `ok`. The V2 ledger inventories 112 surfaces; reachability, both-platform views and each listed sheet/dialog are still pending. Run the f119 ledger again and compare every relevant source location and V4 implementation side by side before replacing this statement with individual audit rows.
