# V2 → V4 port tracker

The spec is the commit in `V2_BASELINE`. Generated numbers come from
`node .agents/skills/accord-port/scripts/port_ledger.mjs plan` and `status`.

Sessions write to `docs/port/status/<name>.md`. Only the integrator edits this file, and folds their rows in when
merging a branch.

## Decisions

These are defaults, and the user can change any of them.

| # | Decision | Why |
|---|---|---|
| D1 | iOS and Android only. V2's `*_web.dart` and `*_stub.dart` are not ported. | The task names iOS and Android |
| D2 | Iroh transport is excluded (`EXCLUDED.txt`). | Dormant in every V2 build path checked |
| D3 | Test mode is ported last, in one place. | 236 call sites would otherwise mix demo data into every function |
| D4 | V4 moves to a development build at the first role that needs custom native code. | Printers, scale discovery and APK install cannot run in Expo Go. `aparatchi` already references the printer channels |
| D5 | New roles live in `src/<domain>/`. Existing worker and chat files stay where they are. | A flat `src/` will not hold 13 roles, and moving files mixes noise into port diffs |
| D6 | Until cutover V4 keeps its own identity and storage keys, with no data migration from V2. | `app.json` sets no bundle id yet; V2 uses `com.example.accord_mobile_v2` on Android and `com.example.accordMobileV2.mirsaid.uzkingshark` on iOS |
| D7 | Logic is ported once and shared. Screens and routes are separate per platform: `src/app/ios-<role>/` and `src/app/android-<role>/`, with `src/app/index.tsx` redirecting by role and platform. | Rules cannot differ by platform without breaking 1:1, while views often must differ |
| D8 | New screens have no `.tsx` fallback, and platform code is type-checked with `tsconfig.ios.json` and `tsconfig.android.json`. | A missing platform file then fails loudly instead of shipping a stub. Plain `tsc` only checks callers against the fallback, and it missed the mismatch listed below |
| D9 | V2 is frozen (agreed 2026-11-05): no new features, only fixes for errors that stop production. Such a fix reaches V4 through a drift sync. | V2 and V4 cannot both keep moving. `lib/src/features/preparation` alone got 7 commits in the 7 days before this |
| D10 | Roles move to V4 one at a time while the rest stay on V2, against the same backend. V4 uses the bundle id `com.accord.mobilev4` on both platforms, so both apps install side by side. | No single risky cutover. Change the id any time before the first store upload |
| D11 | Sessions run in parallel, each in its own worktree on `port/<name>` with its own status file. Only the integrator writes to `main`, merging with `--no-ff` and running the gates after each merge. | One large session strains its context, and limits are not the constraint. At most 5 role sessions run until the first role works on a real phone |
| D12 | Known V2 bugs and missing features are fixed in V4, not V2, after the 1:1 port and in separate commits with a Deviations row. | The V2 comparison stays clean and V2 stays frozen |
| D13 | GoDEX printing is not ported (user, 2026-11-05). `GodexRpsRenderer.kt` and V2's GoDEX test method stay out; the Android USB path supports Zebra. GoDEX names still in `src/workerPrinter.ts`, `src/workerPrintJob.ts`, `src/workerQueueAction.ts`, `src/shared/printApi.ts` and `src/printing/printModels.ts` are for the aparatchi audit to review. | GoDEX is archived and no longer used |
| D14 | Base screens get their own sessions, `base-ios` and `base-android`, next to `preparation`. They compare the existing login, profile, settings and PIN screens with V2 and fill the gaps instead of rewriting them. | Profile is nearly finished on both platforms, and a role cannot be tested on a phone without these screens |
| D16 | A wire session finishes what logic and screen sessions list under "Needs from the integrator". `base-wire` owns the shared login, profile, PIN and app-entry files, so no two sessions edit them at once. | Both base screen sessions stopped at the same shared files |
| D17 | `metro.config.js` gives each platform a route context without the other platform's `ios-*` or `android-*` tree. | D7 and D8 leave those trees with no cross-platform imports, so bundling them together fails |
| D15 | No simulators or emulators, and no stubs or fake behaviour for them (user, 2026-11-05). The user tests on real phones. | The user wants real behaviour only |

## Roles

Parts, order and reading sizes come from `port_ledger.mjs plan`. Mark logic with the parts done, such as `2/3`.

| Role | Logic | Android | iOS | Audit | Notes |
|---|---|---|---|---|---|
| base | 2/2 | partial | partial | | Shared API done except the push-token part of `logout`. Open rows are in `status/base.md`; most belong to the role and screen sessions that use them |
| preparation | 1/1 | partial | partial | | Home, warehouse, materials, formulas, variants and journal have screens. Sequence, inventory, QR printing, scale and chat are open: `status/preparation*.md`. Not yet in `DONE_ROLES.txt` |
| boyoqchi | | | | | V2 has almost no tests for this role |
| customer | | | | | V2 has no tests for this role's API |
| supplier | | | | | V2 has no tests for this role's API |
| aparatchi | 1/4 in progress | | | | Worker controls, reactivation, material delivery, scan bootstrap, queue actions, astatka, preflight, image URLs and compact queue work started; 119/120 listed API entries have tags and part 1 still has an unchecked item. Needs a development build for printing |
| homashyo | | | | | Needs printing |
| chat | | | | | iOS exists without tags; Android ships a stub |
| rezka | | | | | |
| material | | | | | Needs a development build |
| werka | | | | | |
| qolipchi | | | | | |
| admin | | | | | Largest role |
| brigader | | | | | Guards over admin screens; do it after admin |

## Open items

The merged sessions keep their own rows in `docs/port/status/`: `base`, `base-ios`, `base-android`, `base-wire`, `build`, `printer`, `preparation`, `preparation-ios` and `preparation-android`.

| Where | V2 reference | What is needed |
|---|---|---|
| `origin` (`WIKKIwk/accord_native`) | `printer-lib-3.5.8.aar`, `PrinterSDK` | The repo is public and `main` now holds both vendor SDKs. Do not push until the user confirms their redistribution terms or makes the repo private |
| This Mac | Android | No Android SDK is installed, so `expo run:android` fails. A real Android phone needs that SDK or an EAS build |
| `tsconfig.android.json` | | 10 existing errors. `WorkerOutputProgress.android.tsx` and `WorkerPaintPalette.android.tsx` import prop types from themselves once the platform suffix applies, so move those types to a shared file. `WorkerScreen.tsx:347` passes `statusText`, which the Android `WorkerOrderListItem` does not declare; confirm whether Android should show it |
| `src/` | See `port_ledger.mjs check` | 5 V4 endpoints lack a literal V2 reference: `chat/conversations/{}`, `chat/media/{}`, `profile/avatar/view`, `push-config`, `rezka-master/print-side`. V2 constructs the last two dynamically in `mobile_api_push_config.dart` and `mobile_api_rezka_master.dart`; returned-paint image URLs are supplied by the server and appear in `test/returned_paint_models_test.dart` |
| `src/authorizedFetch.ts` | `core/network/mobile_http_client.dart` | Confirm how RN `fetch` handles redirects compared with V2's manual policy |
| `test/raw_material_split_test.dart` | V2 baseline `7c87a54e` | 3 of its 19 tests fail at the baseline, with or without the recorder. Check whether V2 or the test is out of date before homashyo relies on them |
| `app.json` | `record` in `pubspec.yaml` | Android blocks `RECORD_AUDIO`, but V2 chat uses recording. Resolve in the chat role |
| `pdf`, `pdfx`, `model_viewer_plus` | `pubspec.yaml`, `third_party/` | No direct Expo equivalent. Choose an approach before the roles that use them |
| aparatchi part 1 | `.port/role-aparatchi-1.md`, `.port/role-aparatchi-tests.md` | Remaining unchecked API methods, declarations and contract/logic tests still need the baseline comparison and port. A tag alone does not close the gaps below |
| `src/workerControlsApi.ts` | `mobile_api_admin_production_map_helpers_part_02.dart`, `mobile_api.dart` | Complete the shared `MobileApiException` fields and all server error mappings; current worker controls cover the codes exercised so far. V2 applies the 10-second timeout per HTTP attempt, while this port currently applies one timer around a request including any 401 refresh |
| `src/workerPrintPreflight.ts` | `mobile_api_admin_print_preflight.dart`, `mobile_api_admin_queue_models_declarations_part_01.dart` | Compare every optional control-state branch with V2's typed parser. No direct V2 API recording was found for `adminPrintPreflight`; its request and hold parsing have focused V4 tests |
| `src/workerMaterialDelivery.ts` | `mobile_api_material_start_receipt.dart`, `admin_production_map_orders_material_delivery.dart` | No direct V2 tests were found for these two API methods; focused V4 request/confirmation tests follow the baseline source. V2's idempotency suffix uses microsecond clock precision; JavaScript currently supplies milliseconds multiplied by 1000, so repeated attempts inside one millisecond need a verified native clock source |
| `src/workerRawMaterials.ts`, `src/workerQolips.ts` | `mobile_api_admin_raw_materials_*`, `mobile_api_admin_qolip_orders.dart` | The independent readers use V2 requests and model defaults, with recorded assignments and start-requirements replays. Direct V2 recordings for intake candidates, intake writes and independent qolip validation beyond the bootstrap fixture were not found; compare their remaining model edge cases and record them when available |
| `src/workerScanSections.ts`, `src/workerLegacyScan.ts`, `src/OrderScreen.tsx`, `src/workerLongPress.ts` | `admin_production_map_orders_scan_bootstrap.dart`, `admin_production_map_orders_worker_qr_context.dart` | An empty 404/405 falls back to a scoped sequence read; compare its full snapshot validation and legacy null-revision behavior. Independent scoped QR lookup is in place, but legacy lookups without route metadata still require the V2 production-map consumer calculation. Incomplete sections use the independent material/qolip readers |
| `src/workerClosedOrders.ts` | `adminClosedProductionMapOrders` | V2 has no recorded HTTP test for this method; source-derived V4 tests cover its request, closed-order models and server errors |
| `src/workerLaminationApi.ts` | `adminLaminationAstatkaSnapshot` | V2 has no recorded HTTP GET for this method; source-derived V4 tests cover its request, and V2's model tests cover physical roll selection and label settings |
| `src/workerOpenedOrderEditApi.ts` | `CalculateOrderTemplate`, `adminSaveOpenedOrderEdit` | The edit-source reader preserves the exact original and parses template fields for its restriction checks; decimal syntax and Dart-style date formats, overflow and microseconds have focused tests. The date retains microseconds separately because JavaScript's standard Date serialization drops them. The full template serialization/copy helpers and edit save flow remain to be ported |
| `src/workerSnapshot.ts`, `src/workerDelta.ts` | `mobile_api_worker_order_list.dart`, `mobile_api_admin_production_map_state_delta.dart`, `worker_queue_warm_store.dart` | Finish the remaining snapshot/delta, cache and warm-store parity cases and replays; current tests cover compact envelope, membership, typed completed orders and notifications, selected patches and a recorded HTTP response |
| `src/workerApi.ts` | `_readWorkerListDetail`, `admin_production_map_orders_worker_list.dart` | Order details use V2's scoped reader and a single five-second deadline across stale-response retries. V2 also shares unfinished identical detail reads; reconcile that consumer behavior separately |
| `src/workerLive.ts` | `mobile_api_admin_production_map_MobileApiAdminProductionMap_methods_02.dart`, `worker_queue_warm_store.dart` | Session/account changes now stop old stream events, and already applied revisions are ignored. Complete warm-store handoff and compact-to-legacy stream recovery parity. The worker store uses a 10-second first-message timeout; V2's 7-second silence helper is used by the system monitor, not the worker store |
| `src/productionMapSnapshot.ts` | `mobile_api_admin_production_map_snapshot_decoder.dart` | Canonical map, state, control and scope parsing have focused V2 window replays. Compact snapshots expose normalized revisions, order controls and empty authority fields. Reclose controls are bound to their reading session; Rezka lineage, partial rolls, reports and control signatures are normalized. Reconcile remaining compact projection and optional control branches |
| `src/auth.ts`, `src/savedAccountStore.ts`, `src/savedAccountRuntime.ts` | `login`, `logout` | Sign-in uses the shared V2 account decoder, resets session-scoped state on identity change and saves or activates the account with rollback to the prior session on failure. Startup restores the active saved account; reauthentication and profile changes update its saved data. If saved account initialization fails, the single-session fallback supports login, refresh, startup and logout. Logout removes the active saved account while retaining others, including when server logout fails. The metadata/secret store, deferred secret deletion, platform adapters and legacy migration have focused tests. Large native secure values are chunked below Expo SecureStore's historical iOS size limit and verified with bounded-storage mocks; verify the native runtime on a device. Logout invokes the push-token reader before server logout and tolerates its failure, but remains unchecked until the native Firebase token reader below is connected |
| `src/pushTokenRuntime.ts` | `PushMessagingService.unregisterCurrentToken`, `FirebaseClientBootstrap` | Connect `registerPushTokenReader` to an initialized native Firebase Messaging instance on iOS and Android. The backend sends through FCM and V2 obtains an FCM registration token on both platforms; an iOS APNs token from `expo-notifications` is not equivalent. V4 does not yet have Firebase initialization or configured application identifiers, so this native bridge and device validation remain open |
| `src/werkaHomeApi.ts` | `werkaHome` | No V2 HTTP recording was found; a focused V4 test covers its source-derived request and model |
| `src/rezkaMasterSettingsApi.ts` | `rezkaMasterSavePrintSide` | No V2 HTTP recording was found; a focused V4 test covers its source-derived PUT |
| `src/profileApi.ts` | `profile` | No V2 HTTP recording was found; a focused V4 test covers response and conditional session update |
| `src/mobilePushConfigApi.ts` | `mobilePushConfig` | No V2 HTTP recording was found; a focused V4 test covers the source-derived request and platform identity validation |
| `src/logoutSavedSession.ts` | `logoutSavedSession` | No V2 HTTP recording was found; a focused V4 test covers direct token handling and the source-derived request |
| `src/auth.ts`, `src/serverEndpointStore.ts`, `src/mobileApi.ts` | `instance` | The endpoint store implements V2 normalization, saved endpoints and active override persistence; the shared API base URL is connected to startup and sign-in. The singleton preserves instance identity and the base URL, while V4 exposes the other API operations as standalone functions |
| `src/OrderScreen.tsx` | `mobile_api_boyoqchi.dart` `returnedPaintImageUrl`, `test/returned_paint_models_test.dart` | V2 uses the `image_url` returned by the server and persists the image object. V4 currently reconstructs the image URL from `image_id`; port the returned URL and draft fields before marking this flow complete |
| `src/orderThumbnail.ts`, `src/components/WorkerOrderHeader.tsx`, `src/orderImageApi.ts` | `mobile_api_order_images.dart`, `core/cache/order_image_cache.dart` | The byte reader and account-scoped memory/disk cache now cover V2's TTL, ETag, missing-image and logout behavior in focused tests. Existing image views still use their prior loading path; connect and compare that rendering path during the platform UI work. The Expo disk adapter has been tested with a mock, not a device |
| `src/dailyWork.ts`, `src/workerWip.ts`, `src/workerWipApi.ts`, `src/workerProgressApi.ts` | `adminProgressQrHistory`, `adminWipBatches`, `adminProgressQrLookup`, `AdminProgressBatch.fromJson` | Worker history uses V2's request scope, typed batches and paginated readers. Compare UI WIP selection/deduplication. Legacy QR active-order validation uses a fresh canonical snapshot, including compact worker snapshots; the shared snapshot decoder remains an open item above. V2 provided no recorded live HTTP test for progress history; focused source-derived V4 tests cover its worker query and pagination |
| `src/workerOpeningWip.ts` | `adminLookupOpeningWip`, `test/admin_opening_wip_api_test.dart` | The V2 test exercises test-mode data only; focused V4 tests cover the live request and batch decoding from source. Implement its test-mode branch in the deferred test-mode pass |
| `src/workerOpeningWipCandidatesApi.ts` | `adminOpeningWipCandidates` | No V2 live HTTP recording was found; focused V4 tests cover the source-derived request, filtering and error behavior |
| `src/workerOpeningWipRecordsApi.ts` | `adminOpeningWipRecords` | No V2 live HTTP recording was found; focused V4 tests cover the source-derived request and intake decoding |
| `src/workerOpeningWipPrintApi.ts` | `adminPrintOpeningWip` | V2 tests only its test-mode branch; focused V4 tests cover the live request and print response from source |
| `src/paddonItemsApi.ts` | `adminPaddonAddWips`, `adminPaddonRemoveWip`, `adminPaddonRemoveWips` | No V2 HTTP recordings were found for these methods; focused V4 tests cover their source-derived requests and snapshot parsing |
| `src/paddonManagementApi.ts` | `adminPaddonCreate`, `adminPaddonDelete`, `adminPaddonDetail` | No V2 HTTP recordings were found for these methods; focused V4 tests cover their source-derived requests and response validation |
| `src/productionMapAuditApi.ts` | `adminProductionMapAudit` | No V2 HTTP recording was found; focused V4 tests cover the source-derived request and report parsing |
| `src/productionProgressCorrectionApi.ts` | `adminProgressBatchCorrect` | No V2 HTTP recording was found; focused V4 tests cover source-derived validation, request fields and response checks |
| `src/scannedWipApi.ts` | `adminReturnScannedWip`, `adminScannedWips` | No V2 HTTP recordings were found; focused V4 tests cover their source-derived scopes, requests and response validation |
| `src/inventoryRelocateApi.ts` | `inventoryRelocate` | No V2 HTTP recording was found; a focused V4 test covers validation and its source-derived mutation |
| `src/inventoryReadApi.ts` | `inventoryAssets`, `inventoryLocations`, `inventoryTransfers` | No V2 HTTP recordings were found; focused V4 tests cover source-derived queries, model validation, assignment-presence metadata and errors |
| `src/paddonUnlockApi.ts` | `unlockPaddon` | No V2 HTTP recording was found; a focused V4 test covers the source-derived request and identity validation |
| `src/paddonSuccessorApi.ts` | `createActivePaddonSuccessor` | No V2 HTTP recording was found; a focused V4 test covers the source-derived request and response checks |
| `src/paddonConfirmPrintApi.ts` | `confirmPaddonPrint` | No V2 HTTP recording was found; focused V4 tests cover locking, identity and the source-derived request |
| `src/chatDeviceTokenApi.ts` | `chatRegisterDeviceToken`, `chatUnregisterDeviceToken` | No V2 HTTP recordings were found; focused V4 tests cover registration, direct unregister and response errors |
| `src/calculateApi.ts` | `calculate` | No V2 HTTP recording was found; focused V4 tests cover source-derived request serialization, response defaults and error handling |
| `src/authenticateAccount.ts` | `authenticateAccount` | No V2 login HTTP recording was found; focused V4 tests cover account parsing, HTTPS and the source-derived request |
| `src/productionMapReplayApi.ts` | `adminProductionMapReplay` | No V2 HTTP recording was found; focused V4 tests cover the source-derived query and delta decoding |
| `src/productionMapReadApi.ts` | `adminProductionMaps` | No V2 HTTP recording was found for the list route; a focused V4 test covers its source-derived request and parsing |
| `src/productionCompletionApi.ts` | `adminProductionMapCompletionRequestDecisions`, `adminProductionMapCompletionRequests` | No V2 HTTP recordings were found; focused V4 tests cover the source-derived requests and notification parsing |
| V2 baseline oracle | `test/admin_order_early_close_test.dart`, `test/qolip_tasks_test.dart`, `test/worker_network_latency_test.dart`, `test/admin_sequence_list_widget_test.dart`, `test/opened_order_edit_api_test.dart`, `test/qolip_product_transfer_test.dart` | Running the 56 recorded test files against baseline `7c87a54e` produced 603 passes and 28 failures across these six files. Failed cases are not used as specifications; determine whether each relevant failure is a stale test or baseline defect |
| `tests/appLock.test.cjs:52` | V4 test gate | One run failed because the randomly generated hexadecimal salt or digest contained the substring `1234`; a focused rerun and the full suite passed. Replace that probabilistic assertion when the PIN test is in scope |

## Deviations candidates

V2 quirks or bugs that were ported as they are, listed here for a user decision.

| V2 reference | Behaviour | Why it looks wrong |
|---|---|---|
| `mobile_api_re_pause.dart`, `mobile_api_reactivation.dart` | The training-order guard checks `startsWith('training-')` before trimming the order ID, and the request retains the original ID. | Leading whitespace can bypass that local guard. The port preserves the V2 behaviour. |

## Test mode pending

API functions whose V2 version has a test-mode branch. The test mode step clears this list.

| V4 function | V2 symbol |
|---|---|
| `adminCancelStartedWork`, `adminTemporarilyPauseWork`, `adminRePauseResumedWork`, `adminRecloseReactivatedWork` | Their same-named V2 methods reject test mode before sending |
| `adminWorkReactivationPreview`, `adminReactivateCompletedWork` | Their same-named V2 methods reject test mode before sending |
| `adminBosmaAstatkaReport` | V2 creates an in-memory test-mode report |
| `sendOrderAlert` | V2 rejects test-mode sessions and the test-mode setting |
| `adminMaterialStartDeliveryCandidates`, `adminReceiveMaterialForStart` | V2 uses test-mode assignments, inventory assets and relocation |
| `adminRawMaterialAssignments`, `adminRawMaterialIntakeCandidates`, `adminRawMaterialStartRequirements`, `adminReceiveRawMaterialForActiveOrder` | V2 reads or mutates in-memory raw-material assignments and inventory |
| `adminProductionMapQolipRequirements`, `adminApparatusQueueActionResult` | V2 uses test-mode production maps and queue/runtime state. The live response's local training-print fallback also reads `_testModeOrderById` for `order_code`; it stays empty until that shared test-mode store is ported |
| `adminWipBatches` | V2 reads and filters its in-memory progress batches |
| `adminProgressQrHistory`, `adminProgressQrLookup`, `adminLookupOpeningWip` | V2 uses in-memory progress and opening-WIP records |
| `adminProductionMapNotificationEvents`, `adminProductionMapLiveStream` | V2 closes the live stream without opening a socket in test mode |
| `adminProductionMapQueueSnapshot` | V2 builds an in-memory snapshot and can simulate a queue load failure in test mode |
| `adminApparatus` | V2 filters its in-memory canonical apparatus catalog |
| `adminClosedProductionMapOrders` | V2 returns an empty list in test mode |
| `adminEarlyCloseProductionOrder` | V2 rejects early closure in test mode |
| `adminLaminatsiyaAstatkaReport` | V2 stores an in-memory report based on the last report or order start |
| `adminMoveProductionMapOrdersBatch` | V2 validates and mutates in-memory production maps and sequences |
| `adminMoveProductionMapSequence` | V2 reorders its in-memory test-mode sequence |
| `adminOpenedOrderEditSource` | V2 rejects order edits in test mode |
| `adminOpeningWipCandidates` | V2 filters its in-memory confirmed opening-WIP batches |
| `adminOpeningWipRecords` | V2 filters its in-memory opening-WIP records |
| `adminPrintOpeningWip` | V2 prepares a print from its in-memory opening-WIP batch |
| `adminProductionCombo` | V2 reads its in-memory account-scoped combo revisions |
| `adminProductionMap` | V2 reads its in-memory production maps |
| `adminProductionMaps` | V2 returns its in-memory production maps and can simulate a load failure |
| `adminProgressBatchCorrect` | V2 validates and updates an in-memory progress batch |
| `adminProgressQrReprint` | V2 prepares a print job from its in-memory progress batch |
| `adminRawMaterialLookup` | V2 looks up its in-memory raw-material assignment and order |
| `adminReturnScannedWip` | V2 rejects WIP returns in test mode |
| `adminScannedWips` | V2 returns an empty list in test mode |
| `adminTransferProductionMapOrder` | V2 validates and applies an in-memory transfer and idempotency receipt |
| `adminUnlinkRawMaterialAssignment` | V2 removes unlocked in-memory assignments and preserves locked ones |
| `adminValidateProductionMapQolipDetails` | V2 validates in-memory production maps and qolip catalog |
| `cachedOrderImageBytes`, `peekCachedOrderImageBytes` | V2 returns no image in test mode |
| `calculate` | V2 computes locally using test-mode materials |
| `inventoryAssets` | V2 filters and annotates in-memory inventory assets |
| `inventoryLocations` | V2 sorts its in-memory location catalog |
| `inventoryRelocate` | V2 updates the in-memory asset placement and owner |
| `inventoryTransfers` | V2 filters its in-memory transfers by warehouse and status |
| `mobilePushConfig` | V2 rejects requests in test mode |
| `pendingOrders` | V2 returns an empty list in test mode |
| `qolipCatalogDetails`, `qolipCatalogPage`, `qolipProductMolds`, `qolipProducts` | V2 filters and pages its in-memory qolip product catalog |
| `adminRezkaAstatkaReport` | V2 validates the apparatus and stores or replays an in-memory report |
| `adminRezkaAstatkaSnapshot` | V2 derives its session and stage from in-memory queue state and replays stored reports |
| `adminProductionMapAudit` | V2 returns counts from its in-memory production maps |
| `adminProductionMapCompletionRequestDecisions` | V2 filters in-memory decisions by worker |
| `adminProductionMapCompletionRequests` | V2 returns its in-memory completion requests |
| `adminProductionMapOrderControl` | V2 rejects stage control and mutates global controls in test mode |
| `adminProductionMapOrderImage` | V2 returns no image in test mode |

## Drift log

| Date | From | To | What was re-ported |
|---|---|---|---|
