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

## Security review: server monitor live transport withheld

- The previously explored React Native WebSocket stream was removed before any screen integration. React Native 0.88.1 Android builds a WebSocket without disabling redirects; its version catalog specifies OkHttp 4.9.2, whose default follows redirects and TLS-to-cleartext redirects. An ordinary cross-origin Location does not automatically inherit the query: a token is forwarded if the Location explicitly includes it, for example when a proxy reflects the request URI. Deployed proxy behavior and the final resolved Android dependency version were not verified. React Native also attaches any stored origin cookie as an explicit header, while OkHttp removes Authorization but not Cookie on cross-origin redirect. No real socket or backend request was opened during this work.
- `adminServerMonitorLiveUri` now accepts only the authenticated session's normalized HTTPS origin before constructing WSS, matching the existing `authorizedFetch` origin/HTTPS guard. That initial check alone does not enforce redirects. A future native transport must reject cross-origin and insecure redirects before sending credentials and must not forward origin cookies; leave live monitor disconnected until then. This stricter security behavior is an intentional open difference from any V2 flow that would follow such redirects.
- The removed stream's JSON ping, silence timer and pause/resume logic were only mock-tested and were not a safe production transport. They need reimplementation on a verified no-redirect transport, alongside V2's 25-second native control ping and real-device validation.

## Checkpoint: admin summary and store

- `adminSupplierSummary.ts` implements the live summary read/model; `adminStore.ts` ports independent summary/activity loading, bootstrap, refresh, error and listener behavior, with injected readers to reuse the future shared activity API. Five source-derived V4 tests and iOS typecheck passed. No live request was sent.
- The selected f119 mock V2 widget test `admin home defers summary load until after first frame` failed: immediately after `pumpWidget` it expected no summary request, but the source's post-frame callback had already issued `GET /v1/mobile/admin/suppliers/summary`. Do not use that failed test as a behavioral specification. It uses a custom HttpClient, not an instrumented MockClient; no f119 HTTP recording is claimed.
- As a deliberate account-safety difference, `AdminStore.clear()` increments an epoch so old pending responses cannot refill a newly cleared account's state. V2's `clear()` resets flags but does not invalidate in-flight reads. The app must invoke clear on account change and logout; neither runtime integration nor the Admin home/activity screens are connected yet.

## Checkpoint: Admin home behavior and partial contract

- `adminHomeModel.ts` captures the f119 screen's capability-filtered action order, four summary shortcuts, role-specific labels and icons, and loading/error branches. `docs/port/roles/admin.md` records the home surface's partial UI contract. This is logic and documentation only: no route or platform view is added, and the rest of the role contract remains unfinished.
- Two f119 mock V2 widget tests for action and shortcut localization passed independently; four native model tests and iOS typecheck passed. The separate first-frame test failure is retained below. Shared `canOpenRoute` and localization are reused, not reimplemented.

## Checkpoint: Admin drawer behavior

- `adminDrawerModel.ts` captures V2 destination order, capability filtering, push flags and the stack navigation decision. It is data/logic only; reuse `RoleDrawer` when wiring the shell, and preserve V2's close-to-navigation and logout delays. No UI or route has been added.
- Three selected f119 V2 mock drawer widget tests passed independently; three V4 model tests and iOS typecheck passed. Shared `canOpenRoute` and localization were reused. Neither platform's drawer integration is audited or complete.

## Checkpoint: Admin dock and default FAB actions

- `adminDockModel.ts` records V2's filtered dock destinations, primary visibility, selection decisions and default five create-overlay actions. Four V4 model tests, iOS typecheck and the selected f119 V2 sales-home mock widget test passed. No native dock or overlay is connected, and custom FAB actions and dismissal/animation behavior remain open.

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| Entire role | `.port/role-admin-1.md` through `.port/role-admin-8.md` generated at f119 | Complete remaining unchecked methods, models, contracts, logic tests, all reachable screens, sheets, navigation and UI contract. Existing `[x]` tags are imports, not f119 parity evidence. |
| V2 drift | `docs/port/status/baseline-sync.md` | Compare role-relevant `7c87a54e..f11910bb` changes, including dependencies already tagged in V4. A zero drift report against the new pin does not establish that historical drift was re-ported. |
| Recorded contracts | `.port/role-admin-tests.md` | Run each relevant V2 test independently first; record successful f119 cases into distinct nested fixtures, never overwrite the historical top-level files, and port the replays. Coordinate shared stems. Do not run a live-backend mutation. |
| Item groups and paging | `mobile_api_admin_item_groups.dart`, `mobile_api_admin_items_MobileApiAdminItems_methods_01.dart`, `mobile_api_admin_items_MobileApiAdminItems_methods_04.dart` | No direct V2 HTTP recording was found for the seven checkpoint methods. Source-derived tests cover their requests; add a real f119 recording if a suitable V2 mock test is found. |
| Role normalization | `userRoleFromJson`, `profileFromLogin` | The 13 canonical values and `omborchi` alias match. V2 Dart trims U+0085 and lowercases U+0130 to ASCII `i`, while current JS login rejects those role strings; V2 preserves raw input in `FormatException`, while native login produces a `TypeError` with normalized input. Do not reuse login normalization as V2 parity or change login behavior while roles are running. |
| Admin drawer and dock | `admin_navigation_drawer.dart`, `role_navigation_drawer.dart`, `admin_dock.dart` | Destination/stack and default dock/FAB rules have source-derived models. Connect the existing shared drawer and dock on both platforms, preserve 220 ms navigation and 120 ms logout delays, custom FAB actions, overlay/back/animation behavior and every destination. The shell is not implemented. |
| Admin home and activity | `AdminStore`, `AdminHomeScreen`, `AdminActivityScreen` | Summary read/store logic is unconnected; implement home, activity, capability guards, deferred mount timing, hidden activity and refresh, reuse shared shell components, and call `clear` during session reset. The f119 first-frame widget test fails as described above. The shared activity record parser is available in supplier branch `a947a1a` and must be integrated before reuse. |
| Admin settings | `adminSettings`, `updateAdminSettings`, `AdminSettings` | Live source-derived API and model tests exist but no recorded f119 HTTP replay was found. Settings screen, capability guards, saved/loading/error states and demo branch are still unported. |
| Server monitor | `mobile_api_admin_settings_monitor_declarations_part_02.dart`, `warehouse_live_client_io.dart`, `admin_server_monitor_screen_*` | Live transport was withheld: RN Android WebSocket can follow redirects, and its final origin/security cannot be checked before connection from JS. Implement a native transport that rejects cross-origin and insecure redirects before transmitting the session token, then port JSON/control pings, watchdog, pause/resume and retry lifecycle. Backup import and download streams, UI and test mode also remain unported; native streaming and real-phone behavior need verification. The independent oracle passed, but the recorder produced zero records for its custom client. |
| Factory locations | `test/admin_factory_locations_test.dart`, `admin_factory_locations_screen.dart` | The live API/model has source-derived tests but no recorded f119 HTTP replay. V2 test-mode mutation behavior and the screen, editor dialog, apparatus picker and route remain unported. |
| JSON value fidelity | `adminItemGroups`, `AdminItemGroupBulkMoveResult.fromJson` | Dart distinguishes integer-valued double JSON tokens and exact large integers; standard `JSON.parse` does not. Group-name conversion and count parsing therefore differ on those unusual non-string/non-integer payloads. A lossless parser needs evaluation; do not silently mark full parser parity. |
| Existing `adminItemsPage` | `SupplierItem.fromJson` in `app_models_declarations_part_01.dart` | The imported reader parses ordinary catalog payloads. Its JS stringification of nested `order_apparatus_options` / `customer_names` values differs from Dart collection `toString()`; compare nonstandard values and resolve without rewriting the shared reader independently. |
| Admin production queue | `AdminProductionMapOrdersScreen(workerMode: false)` and other admin-only branches | Existing worker queue code covers worker mode, not proof of admin parity. Do not modify protected worker or preparation files; record the specific shared switches and request an integrator change if required. |
| UI/text and platform checks | `.port/role-admin.md`, `.port/text-admin.md` | No Admin surface has been implemented or audited in this checkpoint. Build and verify all reachable surfaces, including the complete sheet/dialog/back-guard inventory. Run text gate, both platform typechecks, lint and Node tests; devices, simulators and emulators were not used. |
| Fetch runtime | `authorizedFetch.ts`, Expo SDK 58 fetch runtime | The standard Expo fetch supports manual redirect handling and the existing tests verify credential stripping on cross-origin GET redirects. The `EXPO_PUBLIC_USE_RN_FETCH` override was unset during this work; if enabled at build time, React Native's XHR fetch does not implement manual redirect mode. Verify credential behavior on both real platforms before relying on that alternate runtime. |
| Large responses | `json_payload_decoder.dart` | V2 decodes JSON >=128K code units in a background isolate. The existing JS path is synchronous; measure on a real admin payload and review the user-visible performance consequence. |

## Deviations candidates

V2 `AdminStore.clear()` does not invalidate pending reads. The port intentionally invalidates them to avoid showing a prior account’s stale data after a session reset; integrate the clear call on session change and logout.

## Test mode pending

| V4 function | V2 symbol |
|---|---|
| `adminItemGroups`, `adminItemGroupTree`, `adminItemUoms`, `adminItems` | Their namesakes read or derive test-mode demo data; this shared mode is deferred and has not been added to the live-path functions. |
| `adminFactoryLocations`, `adminCreateFactoryLocation`, `adminUpdateFactoryLocation`, `adminReplaceFactoryLocationApparatus` | Their namesakes read or mutate the in-memory factory-location catalog in test mode, including duplicate-name and apparatus membership checks. |
| `adminServerMonitor`, `adminStartBackup`, `adminServerMonitorLiveEvents` | V2 reads and updates in-memory demo backup data, and completes the live event stream without opening a socket, in test mode. |
| `adminSettings` | V2 returns demo admin settings in test mode. |
| `adminSupplierSummary` | V2 returns demo supplier summary in test mode. |

## Needs from the integrator

- Extract only the canonical role set and alias lookup shared by login and Admin. Keep login's existing JS trim/lower, error type and normalized error text byte-for-byte. Add a separate V2-compatible Admin adapter (Dart-style U+0085 trim and U+0130 lowercase, with raw-input error semantics), and compare before/after login outputs over all canonical values, alias, invalid/null/non-string and Unicode cases. A f119 oracle confirmed these examples; exhaustive current Dart/Node scalar checks found U+0085 as the only trim-set difference and U+0130 as the only difference for single-scalar lowercasing to ASCII. No auth/base file was changed here.
- Do not enable `useChatUnreadCount` for Admin until a no-redirect, no-cookie live transport is verified; preserve existing worker and preparation Chat behavior.
- Integrate other role branches and shared navigation only after reviewing conflicts and role guards. The Admin home and routes are not wired by this checkpoint.
- Preserve the protected worker and preparation code. Admin's separate branches of shared production queue surfaces still require a reviewed integration plan.

## Surface audit

| V2 surface and location | V4 file | iOS | Android | What differs |
|---|---|---|---|---|
| `AdminDock`, `admin_dock.dart` and default create overlay | `src/admin/adminDockModel.ts` (logic only) | pending | pending | Destination and default action decisions compared with source; platform dock, custom actions, overlay, back, motion and routes remain open. |
| `AdminNavigationDrawer`, `admin_navigation_drawer.dart` | `src/admin/adminDrawerModel.ts` (logic only) | pending | pending | Destination order and navigation plan compared with source and three selected V2 tests; native integration, timing, logout, routes and shell remain open. |
| `AdminHomeScreen`, `admin_home_screen.dart:20` | `src/admin/adminHomeModel.ts` (logic only) | pending | pending | Action/shortcut rules compared with source and two V2 localization tests; neither platform view, shell/dock, routes nor navigation/refresh lifecycle is implemented. |

The remaining V2 ledger surfaces have not been audited. Run the f119 ledger again and compare each relevant source location and V4 implementation side by side; no surface is marked `ok`.
