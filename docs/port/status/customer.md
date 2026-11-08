# customer

Status: part 1 of 1 in progress
Stopped at: integrate Supplier notification detail, complete the text and surface audits on both platforms, and resolve or document the remaining device and lifecycle checks.

## Open items
| Where | V2 reference | What is needed |
|---|---|---|
| Shared dispatch timestamp parsing edges | `app_models_declarations_part_01.dart` `compareCreatedLabelsDesc`; Dart `DateTime.parse` | The comparator now preserves six fractional digits, but extreme date/offset overflows and platform-local daylight-saving transitions remain unverified against Dart. The exported millisecond parser retains its prior behavior. |
| Customer summary integer precision | `app_models_models_part_04.dart` `CustomerHomeSummary.fromJson` | V2 accepts signed 64-bit integer counts. JavaScript cannot represent all of them exactly; the current decoder rejects counts outside its safe-integer range instead of silently rounding. |
| Shared dispatch status trim | `app_models_declarations_part_08.dart` `parseDispatchStatus`; `src/shared/notificationApi.ts` | Customer calls normalize native Dart U+0085 whitespace before using the unchanged shared parser. Other consumers of the shared parser still differ for that edge and need an integrator-owned fix. |
| Large Customer status lists | `json_payload_decoder.dart` `decodeJsonListPayload` | V2 decodes lists of at least 128 KiB in a background isolate. The React Native path currently decodes on the JavaScript thread; assess responsiveness on a real phone with a representative large payload. |
| Customer session wiring | `customer_store.dart`, `app_runtime_reset.dart` | A role context binds one store and notifications controller to the current session and registers their reset path. The role routes mount it on both platforms; account-switch verification on real phones remains open. |
| In-flight refresh at account reset | `customer_store.dart` `clear`, `refresh` | V2 clears its singleton without explicitly cancelling an already pending refresh. Confirm whether an old response can update shared runtime state after an account switch before declaring that lifecycle fully audited. |
| Timestamp ties | `customer_store.dart` `_mergeHistoryItems`, `customer_delivery_runtime_store.dart` `_sorted` | V2 Dart sorting does not guarantee tie order; JavaScript sorting is stable. Exact visible ordering of records with identical timestamps remains unverified. |
| Return dialogs | `customer_delivery_detail_screen__CustomerDeliveryDetailScreenState_methods_01.dart` `_showReturnDialog` | Native centered return/partial/claim dialogs are implemented on both platforms; verify keyboard, outside/back dismissal, focus, resizing and accessibility on real phones. |
| Role surfaces and routing | `.port/role-customer.md`, `.port/text-customer.md` | Home, status, notifications, delivery, shared profile and shared Chat are routed on both platforms using the existing drawer, bottom controls and shared screens. Shared NotificationDetailScreen integration, text and surface audits remain open; the discussion action is intentionally unavailable until that real destination is connected. The V2 swipe helper has no callers in lib, so no untriggered gesture was added. |
| Retained iOS tabs | `customer_home_screen_widgets_part_01.dart:27–30`, `customer_notifications_screen_widgets_part_01.dart:27–54` | V2 disposes the prior root screen when replacing tabs. NativeTabs may retain inactive screen trees and their refresh listeners; check duplicate refreshes and navigation on a real iPhone. The notification listener deliberately stays alive under pushed delivery details, matching V2. |
| Dock timing and device history | `app_root_navigation.dart:21–49` | V2 coalesces root navigation requests until the next frame. Android now uses the correct installed stack-reducer semantics but dispatches immediately; rapid multi-tap timing and nested Chat navigation remain open for a real-phone check or a source-derived timing fix. |
| iOS notification blur edge | `customer_notifications_screen_widgets_part_01.dart:81–94`, `app_root_navigation.dart:43–49` | A stale iOS tab tap is cancelled after any blur, including blur/refocus. This matches V2 when navigation disposed the feed; if V2 pushed an absent Home above a still-mounted feed, V2 could instead open detail late. NativeTabs does not reproduce the same flat route history; the edge and phone behavior remain open. |
| iOS native tab history | `customer_home_screen_widgets_part_01.dart:66–72`, `customer_notifications_screen_widgets_part_01.dart:125–131` | The drawer requests replacement, but the installed iOS TabRouter changes tab selection rather than maintaining V2’s single flat Navigator history. Cross-tab Back behavior needs device validation or a native-navigation design decision. |
| iOS native tabs on secondary screens | `customer_dock.dart`, `customer_status_detail_screen.dart`, `customer_delivery_detail_screen.dart`, `profile_screen.dart` | V2 shows no selected dock destination on status, detail and profile. Expo native tabs keep the containing tab selected; resolve with supported native controls or explicitly defer after real-phone review. Android passes no selection for these screens. |
| Shared chat badge and push refresh | `role_dock.dart`, `customer_dock.dart`, `customer_store.dart` | The reviewed shared session-scoped Chat unread hook is now mounted once in the Customer provider and supplies both platform dock dots. The shared Chat status documents inherited V2 reliability quirks; live backend, account-switch and real-phone behavior, as well as initialized push delivery, remain unverified. |

## Baseline evidence

- Main baseline alignment `dad5041` was merged into the Customer branch; the role-local V2 snapshot and original V2 checkout were verified clean at `f11910bb2c8c7081ce26770e69811b03fd0739ed` before and after the ledger run. A zero-drift result after pinning is not evidence that historical drift in other roles was ported.

- `lib/src/core/api/customer/mobile_api_customer.dart` is byte-identical at V2 7c87a54 and f11910bb (blob `bef012db96c456b6e880b65207d70ceee213a72b`). The four role-ledger methods are now source-ported. `customerHistory` is not included: a pinned-source search found no call sites and the Customer store merges the three status lists instead.
- `lib/src/features/customer/state/customer_store.dart` is byte-identical at both commits (blob `7b499b8a3d5a59c3d4b60e9bd350658ea9ef900c`); `lib/src/core/notifications/store/customer_delivery_runtime_store.dart` is also byte-identical (blob `5e1357676c76e9e2c988c4286a67209e61126d33`). The existing V4 runtime store is reused.
- `lib/src/features/shared/models/app_models_models_part_04.dart` is byte-identical at both commits (blob `5195b5f226bac05657aeb821d33c32cb7e9fc55f`), including the response-mode mapping.
- The diff for the two `customer_delivery_detail_screen` files adds only an `_applyStateChange` wrapper around `setState` and substitutes that wrapper at four calls. Quantity parsing, dialog enable rules, and the four response actions are unchanged between the commits. The installed Dart VM native string implementation includes U+0085 as whitespace; Customer input trimming covers it explicitly.
- `lib/src/core/api/mobile_api.dart` differs only by removal of an unrelated `dart:math` import; Customer transport helper definitions are otherwise unchanged. `json_payload_decoder.dart`, `mobile_http_client.dart`, `api_transport_policy.dart`, `server_endpoint_store.dart`, `session.dart`, and `saved_account_runtime.dart` are byte-identical across the two pins. The API reuses `authorizedFetch`; existing shared transport and device-verification limitations remain in `PORT.md`.
- The shared record model file is byte-identical across both commits (blob `83b6cfb0f0d1e6929f2d56f9e92d7aa02b17143d`), and the dispatch status parser file is byte-identical (blob `691faac9c83227d17a43a8c835cf08db2c263268`).
- `lib/src/features/shared/models/app_models_declarations_part_01.dart` is byte-identical at both commits (blob `55a4dc08b96b01d1620188785249992e1e78e47f`); the installed Dart SDK documents and implements six-digit DateTime fractions. A source search found no worker or preparation imports/calls to the shared dispatch comparator or its runtime stores.

## Verification

- iOS late notification navigation: deferred mark-seen reproduced two failures before the fix. A focus-generation guard now prevents an old tap from opening detail after tab blur, refocus or unmount, while a current tap still opens it. 26 focused feed/navigation tests, iOS typecheck and uncached lint passed; Android remains unchanged with its nine baseline errors.

- Customer drawer history: selecting a different destination now calls `router.replace`, matching V2’s replacement of only the current route. Installed SDK 58 StackRouter regression tests cover both existing Home and absent Profile targets with Back returning to Detail; 15 related tests passed. iOS typecheck and uncached lint passed; Android retains nine baseline worker errors. iOS NativeTabs uses a nested tab router, so identical cross-tab history is not claimed without phone validation.

- Android dock history: use the Customer role navigator and the installed StackRouter `NAVIGATE` action with `pop: true`, which pops to an existing destination and pushes an absent one. Three tests exercise the actual SDK 58 reducer, including Home → Status → Detail → Notifications → Back; ten related navigation tests also passed. iOS typecheck and uncached lint passed; Android retains nine baseline worker errors. Device behavior and V2’s post-frame tap coalescing remain unverified.

- Full Node suite after integrating Chat and the shared dock extension: 1,227 passed and six failed, all six the pre-existing preparation Android Expo UI modifier ESM import failures. No Customer test failed.
- The independent f119 text gate still exits 1: 23 missing V2 literals on each platform are attributed to the not-yet-integrated shared notification detail; it also scans 30 iOS and 41 Android extra literals, most from unrelated preparation and others from developer/accessibility strings. No exceptions have been added solely to green the gate.
- Feed integration regression: a mounted notifications screen receives a Customer refresh after a pushed delivery response and updates the visible records and cache; 18 focused navigation/feed tests passed.

- Customer home pending row: retained V2’s highlighted pending state using the existing platform list/card styling. Focused home, presentation and navigation tests passed (15 total); iOS typecheck and uncached lint passed. Android typecheck retained the nine baseline worker errors. Visual rendering has not been checked on a phone.

- Notification feed lifecycle: kept its store and RefreshHub listeners through pushed detail screens, as V2 does, rather than stopping on blur. The listener stops on unmount or account reset. 21 focused lifecycle, feed and navigation tests passed; iOS typecheck and uncached lint passed. Real-phone tab retention remains open.

- Full pinned-source search found `handleCustomerTabSwipe` and `navigateToCustomerTab` only inside their unreferenced helper file; neither Customer screen invokes them. No swipe gesture was invented.

- Customer Chat badge: after merging main `f0d1fcc`, the existing shared `useChatUnreadCount(session)` runs once in the persistent Customer provider and drives iOS native-tab and Android native-dock dots. 26 focused Customer notification/navigation and shared Chat runtime tests passed, including read-clearing and account reset. iOS typecheck and uncached Expo lint passed; Android retains the nine baseline worker errors. Real-device/backend behavior remains open. The Customer notification view files were renamed without behavioral changes to remove a case-insensitive resolver collision with the controller.

- Customer shell/routes: `tests/customerNavigation.test.cjs` covers both home targets, destination mapping, notification badge suppression, role guards, status/detail transitions, refresh-after-return and shared profile reuse. The existing drawer, profile and chat components are reused; the shared notification detail remains explicitly pending; this checkpoint preceded the subsequent Chat badge hookup. iOS typecheck and lint passed; Android has the same nine baseline worker type errors. Offline iOS and Android JavaScript exports passed, without a simulator or device. Native tab selection, drawer navigation, hardware back and the badge require real-phone checks.

- Customer delivery content: `tests/customerDeliveryViews.test.cjs`, `tests/customerReturnDialogViews.test.cjs` and `tests/customerLogic.test.cjs` passed 12 source-derived tests for permissions, action order, confirmations, response parameters, discussion callback and retry. iOS typecheck and Expo lint passed; Android has the same nine worker baseline errors. Snackbar and native interaction still require real-phone checks.

- Customer return dialogs: `tests/customerReturnDialogViews.test.cjs` and `tests/customerLogic.test.cjs` passed 8 tests for reason order, quantity validation, cancel/confirm labels and response data. iOS typecheck and Expo lint passed; Android retained the same nine worker errors. No phone was used.

- Customer notification content: `tests/customerNotificationViews.test.cjs` and `tests/customerNotifications.test.cjs` passed 10 tests for loading, retry, empty, unread highlight, mark-seen-before-open and clear confirmation. iOS typecheck and lint passed; Android retained the nine existing worker errors. At that checkpoint the views were not yet routed; they are now routed, but remain device-untested.

- Customer home and status content: `tests/customerHomeViews.test.cjs` and `tests/customerPresentation.test.cjs` passed 6 source-derived tests across both platform implementations. iOS typecheck and Expo lint passed; Android retained the same nine pre-existing worker errors. At that checkpoint the views were not yet routed; they are now routed, but remain device-untested.

- `tests/customerPresentation.test.cjs`: 2 source-derived tests passed for status order, quantities, note visibility and notification fallback text. iOS typecheck passed.

- Customer context and session binding: `tests/customerRuntime.test.cjs`, the store lifecycle and notification controller tests passed. iOS typecheck passed. The provider was not yet mounted at that checkpoint; both platform routes now mount it.

- Customer notifications/controller checkpoint: 15 focused tests passed for cache, hidden/unread ordering, clear/seen behavior, refresh coalescing, reset write ordering and store lifecycle. The controller was not yet mounted at that checkpoint; the notification routes now mount it.

- f119 V2 oracle: `test/customer_delivery_runtime_store_test.dart` passed 1 test from a temporary export; no contract fixture was written. Both the original V2 checkout and the isolated snapshot stayed clean at the selected SHA. The role ledger found no Customer HTTP contract tests.
- Customer UI contract is recorded in `docs/port/roles/customer.md`; it lists source screens, state, actions, texts and shared dependencies and is not a parity claim.

- Shared Android bottom bar adds optional `RoleNavigationItem.showBadge`; when absent or false the existing icon, labels, selection and interaction stay unchanged. `node --test tests/customerRoleBottomBar.test.cjs`: 2 passed. Android typecheck has the same nine pre-existing worker errors; no worker or preparation file was edited.

- Customer API checkpoint: `node --test tests/customerApi.test.cjs tests/customerLogic.test.cjs tests/customerStore.test.cjs tests/customerDispatchTimestamp.test.cjs tests/baseNotificationApi.test.cjs tests/baseDispatchRuntimeStores.test.cjs` passed 32 tests. These cover all four source-derived request paths, parameters, bodies, status handling and parsing; no V2 Customer HTTP recording was found. The Supplier parser file remains byte-identical to its checkpoint. iOS typecheck and Expo lint passed; Android retained the same nine pre-existing worker errors.

- Supplier dependency: `src/shared/notificationApi.ts` matches Supplier commit `a947a1a46ff32a8afb0be3e6d25da8a71afa355c` byte-for-byte. Existing notification/runtime tests passed 8/8; 66 source-derived mock outcomes matched the original notification API, including malformed data and non-200 responses. iOS typecheck passed.

- `node --test tests/customerStore.test.cjs`: 7 passed. Tests cover bootstrap, forced refresh, all four requests, non-eager failure timing, ordering, runtime transitions, failure recovery and clear. No direct V2 CustomerStore recording was found.

- `node --test tests/customerDispatchTimestamp.test.cjs tests/baseDispatchRuntimeStores.test.cjs`: 11 passed, including fractional precision, equivalent offsets, negative epochs, equal values, parse failures and the DateTime upper boundary. The existing public millisecond parser still returns the same result for the covered cases.
- `node --test tests/customerLogic.test.cjs`: 5 passed, including native Dart U+0085 trimming for quantity, reason and comment. These are source-derived rule and request-body tests; no V2 Customer HTTP recording was found and no oracle was run.
- iOS typecheck and Expo lint passed after regenerating ignored Expo route types with an offline dev-server start; no simulator or device was used.
- Android typecheck reports the same nine pre-existing errors in `WorkerOutputProgress.android.tsx` and `WorkerPaintPalette.android.tsx`, with no Customer errors.

## Surface audit

Source and native code were compared without a device; “partial” means an open behavior or verification item remains.

| V2 surface and location | V4 file | iOS | Android | What differs |
|---|---|---|---|---|
| Home, `customer_home_screen_widgets_part_01.dart:20–135` and part 02 | `CustomerHome.*`, `CustomerRoutes.*`, `customerPresentation.ts` | partial | partial | Status, shipment and refresh rules are implemented; inactive iOS tabs can retain listeners. Phone rendering and navigation remain unverified. |
| Status list, `customer_status_detail_screen.dart:25–140` | `CustomerHome.*`, `CustomerRoutes.*` | partial | partial | Data, empty state, row order and return refresh are implemented. Native iOS tabs cannot currently show no selected item on this secondary screen; phone checks remain open. |
| Notifications and clear confirmation, `customer_notifications_screen_widgets_part_01.dart:27–130,215–311` | `CustomerNotificationsView.*`, `customerNotifications.ts`, `CustomerRoutes.*` | partial | partial | Cache, unread order, seen/clear and dialog actions are implemented; feed listeners stay active under details. Native tab retention and phone checks remain open. |
| Delivery detail and response snackbar, `customer_delivery_detail_screen.dart:32–233`, methods part 01:12–69 | `CustomerDelivery.*`, `useCustomerScreens.ts`, `CustomerSnackbar.*` | partial | partial | Loading, retry, fields, response order and snackbar are implemented. Discussion is intentionally absent until the reviewed shared destination can be safely integrated; iOS selection and phone checks remain open. |
| Approve confirmation and return/partial/claim dialogs, methods part 01:75–240 | `CustomerReturnDialog.*`, `customerLogic.ts`, `CustomerDelivery.*` | partial | partial | Reason/quantity rules, order, cancel/confirm and requests are source-tested; keyboard, dismissal and accessibility need real-device checks. |
| Shared notification detail, `notification_detail_screen.dart:30–171,302–372`, methods part 01 | Supplier `NotificationDetailScreen.*` (not integrated) | pending | pending | Shared screen is blocked pending account-switch review. Customer must omit its dock footer and replace the shared route for `MAT-DN-` redirects. |
| Shared profile and Chat, `profile_screen.dart:162–198`, `role_dock.dart` | `CustomerRoutes.*`, `CustomerShell.*`, `CustomerDock.android.tsx` | partial | partial | Existing profile/Chat and reviewed unread hook are reused; iOS selection and live/device/account-switch checks remain open. |

## Deviation candidates

- The iOS native tab bar keeps a visible tab selected on Customer status, detail and profile, unlike V2; the Android bar supports no active item. The V2 tab-swipe helper has no callers in the pinned lib tree, so adding a swipe would invent behavior. These remain open rather than claimed as parity.

## Test mode pending

No Customer test-mode branch was identified in the inspected response methods.

## Needs from the integrator

- Integrate Supplier's shared NotificationDetailScreen when its checkpoint is ready. The record parser extraction in this branch is byte-identical to Supplier's checkpoint and will need its identical shared diff reconciled on merge.
