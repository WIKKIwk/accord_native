# Werka UI contract (partial)

Source: V2 `f11910bb2c8c7081ce26770e69811b03fd0739ed`. This is a working reading note, not a complete UI contract. Some content-only view bodies exist, but no Werka screen or route has been completed or wired. Read every remaining V2 surface and complete its states, copy, validation, back behavior, sheets and navigation before marking the contract or either platform done.

## Entry, shared shell and safety holds

- V2 maps `werka` and `omborchi` to Werka and guards Werka routes with `werka.access`; see `app_router_AppRouter_resplit_class_AppRouter_resplit2_static__routeCapabilities.dart:25-47`. `notificationDetail` is a shared route also allowed to supplier and customer. Read the route guards rather than assuming the role string is sufficient.
- `WerkaDock` has Home, Notifications, a primary Create button and Archive, in that order. Home, Notifications and Archive replace the root route; Create opens the existing shared create-hub sheet. The notification badge is based on the real unread store and is hidden on the notification tab. Do not fabricate counts or wire the account-unsafe store before its hold is resolved. On Profile the primary FAB is hidden while the overlay requires it. Source: `widgets/werka_dock.dart`.
- The Home drawer contains Home, Notifications, Archive, Profile and Tarozi mode, followed by Inventory movements and My warehouse only when their capability guards pass. Tarozi and the optional destinations are pushed; the first four invoke the Home drawer's replacement handler. Source: `widgets/werka_navigation_drawer.dart` and `werka_home_screen.dart`. Reuse the existing native drawer and Profile, omitting `onDailyWork` for this role. Shared Chat remains under its transport hold and must not get a new Werka route or subscription.
- The existing FAB menu is shared with Admin in V2. Its five actions, in order, are `QR skaner`, `unannouncedTitle`, `customerIssueTitle`, `batchDispatchTitle`, and `Tarozi / printer`, opening scan, unannounced, customer issue, batch dispatch and GScale respectively. Source: `widgets/werka_create_hub_sheet.dart`. Reuse existing native FAB rather than recreating it.
- Shared Notification detail and hidden/unread stores have known account-switch hazards. Do not expose their routes or actions until the integrator resolves those holds. Native Werka route files are intentionally absent on this branch.

## Home and status flows

### WerkaHomeScreen

Source: `werka_home_screen.dart:23-425`, `state/werka_store.dart`.

- Native title uses `werkaRoleName` (`Omborchi` in Uzbek); drawer and Home dock are shown. On entry call `bootstrapHome`; it consumes a non-forced bootstrap once when available, otherwise fetches Home. A relevant RefreshHub `werka` event and app resume call refresh. Pull-to-refresh also refreshes Home.
- Show a loading indicator only while first load is pending. If the first load errors, show retry; after a successful load retain content while subsequent loads run or fail. The three summary tiles are `pendingStatus`, `confirmedStatus`, `returnedStatus` with their counts, opening the corresponding status breakdown in that order.
- Show the expandable `inProgressItemsTitle` section only when pending records exist. Expanded state persists in the V2 store while moving between screens. Every pending row shows item name, supplier name, sent quantity rounded to zero decimal places with UOM, and created label. A delivery note opens customer delivery detail; other records open Werka detail.
- The pending projection helper is in `src/werka/werkaPendingLogic.ts`; the stateful store, account-safe lifecycle, refresh and runtime reconciliation remain to be built. Reuse the shared record parser and existing list/card components. The home implementation must not invent an empty-state message.

### WerkaStatusBreakdownScreen

Source: `werka_status_breakdown_screen.dart:14-164`, `werka_store.dart:76-95, 199-228, 276-342`.

- Receives `kind` (`pending`, `confirmed`, or `returned`); title is the corresponding status key. Calls `bootstrapBreakdown`, with pull refresh and a reload after returning from a selected supplier's detail.
- Pending is derived from the full pending list, grouped by trimmed supplier reference or, if blank, trimmed supplier name. Confirmed/returned read the status breakdown endpoint. Show loading only while no rows are available; show retry on error only while no rows are available; otherwise show the `noStatusRecords` empty text or the list.
- Rows show supplier and the `sentQtyStatus` metric: sent quantity for pending, accepted for confirmed, returned for returned. Selecting a row passes kind, supplier reference and name to Status Detail.

### WerkaStatusDetailScreen

Source: `werka_status_detail_screen.dart:17-176`, `werka_store.dart:96-105, 231-273, 344-351`.

- Receives kind, supplier reference and name; title is `statusWithName`. Loads pending records by filtered full-pending list, and other kinds from the status-details endpoint. Loading/error/empty behavior matches the source, with `noRecordsYet` for empty; nonempty list has pull refresh.
- A delivery-note row opens customer delivery detail. A pending non-delivery record opens Werka detail and refreshes on return. Other records open shared notification detail, which remains under the safety hold.

## Create and archive index

### WerkaCreateHubScreen

Source: `werka_create_hub_screen.dart:9-87`. Title is `createHubTitle`. The four rows, in order, are `QR skaner` / `Paddon yoki WIP ma’lumotini ko‘rish va ixtiyoriy kirim`; `unannouncedTitle` / `unannouncedDescription`; `customerIssueTitle` / `customerIssueDescription`; and `batchDispatchTitle` / `batchDispatchDescription`. Each opens the matching scan, unannounced, customer-issue and batch-dispatch flow. Create dock is active. The sheet entry has an additional Tarozi action; do not conflate the two surfaces.

### WerkaArchiveScreen and WerkaArchivePeriodScreen

Source: `werka_archive_screen.dart:12-67`, `werka_archive_period_screen.dart:12-103`.

- Archive root title is `archiveTitle` (`Data` in Uzbek). The three rows are `archiveReceivedTitle`, `archiveSentTitle`, `archiveReturnedTitle`; received/returned open Period with their kind and sent opens Sent Hub. Archive dock is active.
- Period title is the selected kind title; its three rows are `archiveDailyTitle`, `archiveMonthlyTitle`, `archiveYearlyTitle`, opening the respective calendar with the selected kind. Its dock has no selected tab. Router defaults a missing/wrong kind to `sent`; see `app_router_AppRouter_resplit_class_AppRouter_resplit2_static_methods_01.dart:114-155`.

## Scanner and receive flows (partial)

Sources: `werka_stock_entry_qr_scan_screen_widgets_part_01.dart`, `werka_qr_preview_screen.dart`, `werka_paddon_receive_screen.dart`. The remaining UI, dialog and device details still require a full surface audit.

- Scanner uses the back camera for QR and Data Matrix with duplicate suppression. Its initial status is `QR kodni ramkaga keltiring`; a failed camera offers retry. Manual entry stops the camera, sets a processing guard, opens the manual dialog, and restarts the camera on cancel. Processing ignores repeated frames. Disposal must prevent late resolution from navigating.
- Parse a valid archive QR first and replace the scanner route with Archive Batch QR Lookup without a network call. An invalid `/A/` QR without a nonempty barcode/EPC query stays on the scanner, shows `QR kodi noto‘g‘ri.` and resumes the camera. The URL query check takes precedence over the archive-path rejection for malformed archive payloads. Other nonblank input goes to the read-only QR-preview endpoint first, with no code-length/type guesses. A successful server preview replaces the scanner with QR Preview. Only the explicit `qr_not_found` error falls back to Stock Entry Lookup; forbidden, ambiguous, malformed, missing endpoint and network failures show their V2 message and resume the scanner. Pure decisions are in `src/werka/werkaScanLogic.ts`. The unwired `werkaScannerFlow.ts` models the role-specific processing lock, stopping before manual input or lookup, cancel/retry and stale-result suppression using injected functions. Its `stopCamera` cannot promise native release until an adapter can prove it. `werkaQrPreview` checks scope/permission before initial send and 401 retry and after response decoding; this does not cancel a sent GET or guard redirect hops, other reads, same-epoch ABA or auth-change notifications. No controller callback replaces the network guard. Native camera, auth notifications, lifecycle, manual dialog and route handling remain unconnected.
- QR Preview delegates Paddon to Paddon Receive with its initial snapshot; WIP opens WIP Preview with its initial snapshot. Both are read-only until the user chooses a warehouse and confirms a separate receive dialog. If exactly one warehouse is offered, preselect it; otherwise require selection. Respect `can_receive`, a nonempty snapshot token, no prior receipt, no reload-required state and no concurrent operation. WIP additionally requires batch ID and QR payload.
- WIP body presents item name (falling back to item code), order, QR, finished-goods kg/metres if supplied or produced quantity and unit otherwise, location, optional worker and description, and the receipt/blocking status. Known apparatus IDs in labels are replaced by preview names or the V2 Uzbek unavailable fallback. Receipt details include warehouse, receiver and time. `WerkaWipContent` is an unwired partial body: it omits receipt time and delegates confirmation, guarded writes, refresh and next-QR routing to the future controller; exact source layout, accessibility and full numeric/localization parity remain unverified.
- The Paddon receive footer reuses `WerkaReceiveFooter` shared with WIP on both platforms. It preserves the source blocked warning, warehouse selection, receipt receiver/warehouse, refresh and next-QR actions as callbacks only. It omits receipt time and does not implement the V2 `AparatchiPaddonDetailScreen` body, optional name loading/merge, confirmation, guarded write, shell, route or device behavior. The future caller must bind all actions to a live account generation and freshly checked state.
- `WerkaReceiveFlow` is a source-based, unwired confirmation/reload model with an injected guard evaluator and injected network functions. A failed attempted write sets an instance-local uncertainty latch that remains locked after refresh. A read may precede a late server commit, and disposal/new controller currently loses that latch, so backend guarantees and cross-remount reconciliation must be verified before any real route is enabled. Its snapshot is hidden on the next read when its guard is invalid, but auth notifications/remount remain required.
- Paddon confirmation uses title `Paddonni kirim qilish`, cancel `Bekor qilish`, confirm `Kirim qilish` and a message containing pallet code, roll count and warehouse. WIP uses `WIPni kirim qilish` with the same buttons and identifies the item and warehouse. Do not retry a failed/uncertain receive automatically: require a fresh read before another write because the first may have committed. WIP reload must reject a changed batch identity. Both retain an offered prior warehouse on refresh, otherwise select the only one or clear the selection. Their exact read/receipt/error states and back guards must be compared before views are marked complete.

### Stock-entry lookup and customer issue from a QR

Sources: `werka_stock_entry_lookup_screen_models_part_01.dart`, `werka_stock_entry_lookup_screen_models_part_03.dart`, `werka_stock_entry_lookup_screen_widgets_part_02.dart`.

- Title `QR natija`, subtitle scanned barcode. Load by scanned barcode. Loading shows the source context; error offers retry and replacement back to scan. Successful results show each stock-entry line and its quantity, status, item, code, optional company/barcode/warehouse/remarks and line number. Document status is `Draft`, `Submitted`, `Cancelled` or `Doc <number>`; warehouse text uses `—` for a blank side and ` → ` between sides.
- Each entry asynchronously loads customers for its trimmed item code and item name, with a generation counter so an older result cannot replace a newer entry's selection. It prefers the first customer whose name is not `saidamin`, otherwise the first. Picker is a dismissible, draggable, safe-area bottom sheet using the existing async search picker, with `selectCustomer`, `searchCustomer`, customer name and phone. It is disabled while submitting or for blank item code.
- The `Customerga jo‘natish` button is enabled for a nonblank item code, positive quantity and a selected customer when not submitting. The submit step additionally validates a nonblank customer reference. It sends the trimmed item code, exact quantity, entry barcode when nonblank otherwise scanned barcode, source stock-entry name and line index. `src/werka/werkaStockIssueLogic.ts` contains the pure payload/record projections. A successful write records item activity, constructs a pending customer-issue dispatch, notifies Werka runtime and navigates to success with `QR scan ga qaytish`; account-safe runtime and route wiring remain open.
- On failure the source displays insufficient-stock localization, `Bu QR oldin customerga jo‘natilgan.` for duplicate source, `Bu mahsulot uchun customer topilmadi.` for missing customer, or `customerIssueFailed(error)`. The per-entry submitting indicator and duplicate-submit guard must remain active until completion; no fake success or automatic repeat.

## Archive batch QR panel (partial content)

Sources: `werka_archive_batch_qr_lookup_screen_helpers_part_01.dart:1-362`, `werka_archive_batch_qr_lookup_screen_widgets_part_02.dart:1-188`. V2 resolves an exact customer item, then prefers a non-saidamin customer if available, falling back to the option customer. During loading it shows the scanned item and lookup message; an error shows `Mahsulot topilmadi` and the source error text; resolution shows the item, selected customer, Netto, Brutto, optional date, code, customer and optional warehouse. The customer row opens an async picker and sending creates a customer issue, records activity and navigates to success. Error/resolved states also show rescan and back actions.

`WerkaArchiveBatchContent` supplies only the read-only panel on both platforms with existing native list/rows. It omits the picker, send and navigation actions until account-safe reads, mutation reconciliation and routes are available. Loading/error handling beyond supplied state, source layout/accessibility, Dart-specific trim, numeric edges and device verification remain open.

## Notification rows (partial content)

Sources: `werka_notifications_screen_models_part_02.dart:1-416`, `werka_notifications_screen_declarations_part_03.dart:1-185`. V2 removes hidden records, places explicitly unread-highlighted records before others while preserving each group order, and shows an event-dependent title, highlight-or-item secondary line, sent/accepted quantity metric, status icon and date. Its loading, retry, empty state, clear-all confirmation, unread updates and detail routing are separate parts of the screen.

`WerkaNotificationRows` renders only supplied records and explicitly supplied highlight IDs, with a caller-provided refresh callback. It reads no store, invents no unread count, subscribes to nothing and exposes neither clear nor detail actions. It is not a full screen: safe account-scoped sources/refresh, loading/empty/error and clear/detail behavior, shell/dock, Dart-specific U+0085 highlight trimming, source styling/accessibility and device checks remain open.

## Customer delivery detail (partial content)

Source: `werka_customer_delivery_detail_screen.dart:14-231`. The title is `customerShipmentTitle`. The header shows `supplierName` and a status chosen from accepted, rejected, partial, cancelled, pending and draft. Rows show item, sent quantity, accepted quantity only if positive, status and created label. The note uses trimmed source note, the pending explanation if empty and pending, or `noExtraNote`. V2 shows `openDiscussionAction` for accepted/rejected and opens shared Notification detail with the result event ID.

`WerkaDeliveryContent` supplies the read-only body on both platforms using existing native list/row components. The discussion action is not rendered or wired while shared Notification detail is under its account-switch hold. Title/dock, source layout/accessibility, auth-safe record handoff, Dart-specific U+0085 note trimming, complete numeric edge cases and device verification remain open.

## Standalone success (partial content)

Source: `werka_success_screen.dart:8-148`. `customer_issue_pending` shows `sentSuccess`, uses sent quantity in `sentToCustomerLine`, and defaults to `createFlowBack` / Create Hub. `werka_unannounced_pending` shows `createdSuccess`, uses sent quantity in `createdLine`, and has the same default return. Every other event shows `receivedSuccess`, uses accepted quantity in `receivedLine`, and defaults to `pendingListBack` / Home. Explicit return label and route override those defaults, including empty strings. The card contains the record ID and a verified icon; the button uses push-and-remove-until the first route.

`WerkaSuccessContent` provides only the record and return-action body on both platforms, reusing existing native list/card/button components. Its callback does not navigate or imply a write succeeded. A caller must verify the actual successful write, active session and safe route, then implement the source back-stack behavior. The iOS list body does not yet reproduce all source spacing, and the complete shell, title, dock, device accessibility and surface audit remain open.

## Remaining contract and views

The following need complete source-by-source reading before implementation: Notification detail; archive batch QR lookup; daily, monthly and yearly calendars; archive list and PDF actions; sent hub; batch dispatch, review and success; customer delivery detail; customer issue with QR prefill; receipt detail and confirmation; notifications; Paddon receive; QR and WIP previews; stock-entry lookup; scanner and manual QR dialog; standalone success; unannounced supplier flow; async picker sheets; all associated errors, guards, haptics, localization, cancellation and back behavior. The generated `.port/role-werka.md` and `.port/text-werka.md` are local reading aids, not proof of coverage.

See `docs/port/status/werka.md` for the current open items, contract recordings and verification results.
