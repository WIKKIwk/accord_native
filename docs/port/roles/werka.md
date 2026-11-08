# Werka UI contract (partial)

Source: V2 `f11910bb2c8c7081ce26770e69811b03fd0739ed`. This is a working reading note, not a complete UI contract. No Werka view or route has been implemented yet. Read every remaining V2 surface and complete its states, copy, validation, back behavior, sheets and navigation before marking the contract or either platform done.

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

## Remaining contract and views

The following need complete source-by-source reading before implementation: Notification detail; archive batch QR lookup; daily, monthly and yearly calendars; archive list and PDF actions; sent hub; batch dispatch, review and success; customer delivery detail; customer issue with QR prefill; receipt detail and confirmation; notifications; Paddon receive; QR and WIP previews; stock-entry lookup; scanner and manual QR dialog; standalone success; unannounced supplier flow; async picker sheets; all associated errors, guards, haptics, localization, cancellation and back behavior. The generated `.port/role-werka.md` and `.port/text-werka.md` are local reading aids, not proof of coverage.

See `docs/port/status/werka.md` for the current open items, contract recordings and verification results.
