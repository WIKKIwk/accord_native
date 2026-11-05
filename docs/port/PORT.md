# V2 → V4 port tracker

The spec is the commit in `V2_BASELINE`. Generated numbers come from
`node .agents/skills/accord-port/scripts/port_ledger.mjs plan` and `status`.

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

## Roles

Parts, order and reading sizes come from `port_ledger.mjs plan`. Mark logic with the parts done, such as `2/3`.

| Role | Logic | Android | iOS | Audit | Notes |
|---|---|---|---|---|---|
| base | | | | | V4 has part of this; tag and audit it |
| preparation | | | | | Suggested first trial of the whole cycle. The QR label reprint in the production screen needs printing, which waits for a development build |
| boyoqchi | | | | | V2 has almost no tests for this role |
| customer | | | | | V2 has no tests for this role's API |
| supplier | | | | | V2 has no tests for this role's API |
| aparatchi | 1/4 in progress | | | | Worker controls, reactivation, material delivery, scan bootstrap, queue actions, astatka, preflight, image URLs and compact queue work started; 102/120 listed API entries have tags and part 1 still has unchecked items. Needs a development build for printing |
| homashyo | | | | | Needs printing |
| chat | | | | | iOS exists without tags; Android ships a stub |
| rezka | | | | | |
| material | | | | | Needs a development build |
| werka | | | | | |
| qolipchi | | | | | |
| admin | | | | | Largest role |
| brigader | | | | | Guards over admin screens; do it after admin |

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
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
| `src/workerScanBootstrap.ts`, `src/workerScanSections.ts`, `src/workerLegacyScan.ts`, `src/OrderScreen.tsx`, `src/workerLongPress.ts` | `mobile_api_admin_order_scan_bootstrap.dart`, `admin_production_map_orders_scan_bootstrap.dart`, `admin_production_map_orders_worker_qr_context.dart` | Scan control, typed QR proof, candidate-page checks and canonical queue-context decoding are in place. The snapshot decoder and optional control branches still require full parity, so `adminOrderScanBootstrap` stays unchecked. An empty 404/405 falls back to a scoped sequence read; compare its full snapshot validation and legacy null-revision behavior. Independent scoped QR lookup is in place, but legacy lookups without route metadata still require the V2 production-map consumer calculation. Incomplete sections use the independent material/qolip readers |
| `src/workerQueueAction.ts` | `mobile_api_admin_queue_action_result.dart`, `mobile_api_admin_queue_action_result_backend.dart`, `mobile_api_admin_queue_action_models.dart` | Request fields, control/ACK validation, progress batches, print-job data, activity, status, completion requests and Rezka reports have focused V2 replays. Local training print fallback lacks V2's `_testModeOrderById` map lookup for `order_code` because the shared test-mode store has not been ported. Complete that lookup, the deferred test-mode branch and native printing before tagging this method or its result model |
| `src/workerClosedOrders.ts` | `adminClosedProductionMapOrders` | V2 has no recorded HTTP test for this method; source-derived V4 tests cover its request, closed-order models and server errors |
| `src/workerLaminationApi.ts` | `adminLaminationAstatkaSnapshot` | V2 has no recorded HTTP GET for this method; source-derived V4 tests cover its request, and V2's model tests cover physical roll selection and label settings |
| `src/workerOpenedOrderEditApi.ts` | `CalculateOrderTemplate`, `adminSaveOpenedOrderEdit` | The edit-source reader preserves the exact original and parses template fields for its restriction checks. The full template serialization/copy helpers and edit save flow remain to be ported |
| `src/workerSnapshot.ts`, `src/workerDelta.ts` | `mobile_api_worker_order_list.dart`, `mobile_api_admin_production_map_state_delta.dart`, `worker_queue_warm_store.dart` | Finish the remaining snapshot/delta, cache and warm-store parity cases and replays; current tests cover compact envelope, membership, selected patches and a recorded HTTP response |
| `src/workerDetailApi.ts`, `src/workerApi.ts` | `workerProductionOrderDetail`, `decodeProductionMapQueueSnapshotPayload` | Order sheets and the overview use the scoped detail reader with canonical snapshot validation and V2 valid and invalid response replays. Complete all canonical optional-control branches and match the single outer deadline across a stale-response retry before tagging this API |
| `src/workerLive.ts` | `mobile_api_admin_production_map_MobileApiAdminProductionMap_methods_02.dart`, `worker_queue_warm_store.dart` | Session/account changes now stop old stream events, and already applied revisions are ignored. Complete warm-store handoff and compact-to-legacy stream recovery parity. The worker store uses a 10-second first-message timeout; V2's 7-second silence helper is used by the system monitor, not the worker store |
| `src/productionMapLiveStream.ts` | `adminProductionMapLiveStream`, `admin_production_map_paged_socket_test.dart` | The scoped socket, compact-to-legacy negotiation, cursor checks, canonical snapshot parsing and cancellation have focused tests. Pause/resume now buffers delivery in order; complete the remaining snapshot decoder branches before tagging this API |
| `src/productionMapNotifications.ts` | `adminProductionMapNotificationEvents`, `admin_production_map_paged_socket_test.dart` | Shared account-scoped notification sockets, latest-value replay, cancellation, cursor checks and the legacy snapshot path have focused tests. Complete canonical snapshot parity before tagging this API |
| `src/productionMapSnapshot.ts`, `src/productionMapQueueSnapshotApi.ts` | `adminProductionMapQueueSnapshot`, `mobile_api_admin_production_map_snapshot_decoder.dart` | Canonical map, state, control and scope parsing plus coalescing, fresh-read isolation and 304 cursor handling are in place with recorded V2 window replays. Reconcile all compact projection and optional control branches before tagging this API |
| `src/auth.ts` | `login`, `logout` | Existing single-account sign-in/sign-out has no V2 saved-account activation, rollback, removal or push-token unregister lifecycle; port that shared store before tagging these methods |
| `src/werkaHomeApi.ts` | `werkaHome` | No V2 HTTP recording was found; a focused V4 test covers its source-derived request and model |
| `src/rezkaMasterSettingsApi.ts` | `rezkaMasterSavePrintSide` | No V2 HTTP recording was found; a focused V4 test covers its source-derived PUT |
| `src/profileApi.ts` | `profile` | No V2 HTTP recording was found; a focused V4 test covers response and conditional session update |
| `src/mobilePushConfigApi.ts` | `mobilePushConfig` | No V2 HTTP recording was found; a focused V4 test covers the source-derived request and platform identity validation |
| `src/logoutSavedSession.ts` | `logoutSavedSession` | No V2 HTTP recording was found; a focused V4 test covers direct token handling and the source-derived request |
| `src/auth.ts` | `baseUrl`, `instance` | V2 has a process-wide active endpoint and API singleton; V4 currently carries the selected server in each session. The unscoped getter and singleton still need an equivalent before tagging |
| `src/productionOrderPageApi.ts` | `adminProductionOrderPage`, `admin_order_page_api_test.dart`, `admin_orders_list_api_test.dart` | Conditional requests, projected rows, pagination checks and legacy-page reads have focused V2 replays. Full snapshot/template decoding and the diagnostic identity-compression setting are still needed before this method is tagged |
| `src/productionOrderDetailApi.ts` | `adminProductionOrderDetail`, `admin_orders_list_api_test.dart`, `admin_sequence_list_api_test.dart` | The generic and apparatus-scoped requests and invalid-detail cases replay V2. The shared snapshot decoder and diagnostic identity-compression setting still need full parity before this method is tagged |
| `src/OrderScreen.tsx` | `mobile_api_boyoqchi.dart` `returnedPaintImageUrl`, `test/returned_paint_models_test.dart` | V2 uses the `image_url` returned by the server and persists the image object. V4 currently reconstructs the image URL from `image_id`; port the returned URL and draft fields before marking this flow complete |
| `src/orderThumbnail.ts`, `src/components/WorkerOrderHeader.tsx`, `src/orderImageApi.ts` | `mobile_api_order_images.dart`, `core/cache/order_image_cache.dart` | The byte reader and account-scoped memory/disk cache now cover V2's TTL, ETag, missing-image and logout behavior in focused tests. Existing image views still use their prior loading path; connect and compare that rendering path during the platform UI work. The Expo disk adapter has been tested with a mock, not a device |
| `src/dailyWork.ts`, `src/workerWip.ts`, `src/workerWipApi.ts`, `src/workerProgressApi.ts` | `adminProgressQrHistory`, `adminWipBatches`, `adminProgressQrLookup`, `AdminProgressBatch.fromJson` | Worker history uses V2's request scope, typed batches and paginated readers. Compare UI WIP selection/deduplication. Legacy QR active-order validation now uses a fresh canonical global snapshot; its full decoder remains open. V2 provided no recorded live HTTP test for progress history; focused source-derived V4 tests cover its worker query and pagination |
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
| `adminProductionMapQolipRequirements`, `adminApparatusQueueActionResult` | V2 uses test-mode production maps and queue/runtime state |
| `adminWipBatches` | V2 reads and filters its in-memory progress batches |
| `adminProgressQrHistory`, `adminProgressQrLookup`, `adminLookupOpeningWip` | V2 uses in-memory progress and opening-WIP records |
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
