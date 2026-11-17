# Qolipchi UI and behavior contract

Specification: V2 baseline `f11910bb2c8c7081ce26770e69811b03fd0739ed`. The Qolip feature/API source is unchanged at live V2 `052655a4`. Both platforms are implemented and routed. Current verification, surface-by-surface evidence and remaining native limitations are in `docs/port/status/qolipchi.md`; older “unwired/held” checkpoint descriptions are superseded.

## Entry, navigation and ownership

`qolipchi` with `qolip.manage` enters the platform's `*-qolip` role tree. Keep the original account witness for every page, sheet, camera, pending request and retry; a retired owner cannot revive when the same identity later returns. Render the source drawer header `Bo‘limlar` and destinations in this order: Home, Blocks, Products, Checkouts, Location transfer, Sequence, Tasks, Profile, Product transfer, Sets, Reworks, Paddons, Archive. Preserve source localized destination words, logout prompt and existing chat/unread behavior.

Home navigation restores/dismisses to the existing Home; other drawer/dock destinations replace the source root route. Native iOS tabs persist outside child pages, with a real local dock on the full-page storage picker. Android reuses the worker native header, list, filters, bottom bar and FAB controls. Sheets remain sheets, confirmations remain dialogs and notices remain transient notices. Native control appearance may differ under D7; fields/actions/defaults/validation and operation order do not.

## Home and blocks

Load and cache source warehouse/block data and each block's locations, retaining the source future/account lifetime. Initial loading, disconnected retry, no assigned blocks and no added blocks are distinct states. Search keeps raw input, uses the Qolip keyboard/fuzzy matcher and highlights block/cell counts. Profile hides while search has focus. Keep source tab order, saved-key behavior, measured-center long-press reorder, original selected block, release and cancel rules.

Render the fixed source grid, counts, placed/unplaced molds and cell details. Long-press cell printing uses the real printer picker. Home actions include block creation, product spec, attaching existing available molds, taking/issuing to workers and moving between cells/blocks. Keep source worker choices, default quantity 1, maximum validation, vertical confirmations, sequential one-unit bulk operations, partial success and authoritative readback checks. Never describe sequential placement as a transaction. Read source targets before writes where V2 does so; an account change stops remaining writes and late publication.

Cell-placement picker loads eligible saved specs, excludes in-use/placed codes, deduplicates normalized mold codes, preserves source order and fuzzy relevance, uses 80-item pages and source query-future lifetime. Product-spec mode instead uses server-side product search with limit80 and no later server page. Preserve selected product locking when an order supplies it. Block create defaults to the source warehouse and hides its field only under the source condition.

Blocks page uses source native search, warehouse/name matching and server order. Row long-press opens Edit/Delete. Edit ignores empty/unchanged trimmed names; delete confirms with source name/body. Successful writes show the source notice and reload; failures resolve the source error key. Dialog closure precedes the source save request.

## Catalog, sets, shared reuse and rework

Products uses the existing QolipCatalogStore. Nonempty search debounces250ms; clear reloads immediately. Retire stale detail continuations immediately on input change. Keep cached windows, per-container lazy details/images, rework revision merge, source pagination and expanded-container preservation. Container and individual-mold selection are exclusive; in-use/away molds keep their source restrictions. Native search is replaced by the source selection header.

Bind source Create/spec, Edit, Add mold, Delete, set attach, QR copy/reprint/mileage, batch printing, PDF and rework actions. Edit resolves the source shared-set warning before opening and closes before dispatch. Batch spec/create validates source batch syntax, 32-bit positive sizes, exact color count/order, warehouse and PANTON limits. Saved specs expose the source QR print step. Edit retains Dart int.tryParse syntax and exact outbound int64 JSON tokens.

Shared reuse resolves the chosen set, confirms its exact member/product description and retries the source changed/ambiguous set flow. Suggestions debounce200ms, show the first three plus Show all, and use the existing async Qolip set matcher. Set picker uses the source M3 default50 local rows per page, 220ms search and near-end continuation; product picker reads at most80. Keep nested picker/search/empty/error/retry/close behavior.

MoldAdd is a dialog: outside tapping does not dismiss it; hardware Back is allowed while idle and blocked while saving. Standalone set creation blocks dismissal only while saving; cell-placement and product-spec sheets retain source dismissal behavior. SetName uses the original Unicode16 grapheme cap and separate API rune validation, saving guards and exact conflict messages.

Sets keeps source search, grouped member presentation, available/used/rework flags, creation, rename action sheet then name dialog, add/remove member confirmation and mutation refresh. Rework commands deduplicate in source order, retain request IDs for exact retry and preserve source send/return selection, partial/error notices and mileage history.

Code details orders header, QR preview, item name, selectable/copyable payload, detail rows, optional mileage and reprint. Only Qolip-allowed actions appear; the shared Rps delete-QR branch is unreachable. Printing uses the actual shared device chooser and transport/probe, with source cancellation/error behavior. GoDEX remains excluded by D13.

Product PDF fetches the exact shared-sets reader by item_code, then uses source set/code ordering and extension section, original fonts/logo/color names, UTC label, A4 sizing, safe filename, metadata and actual X/Y page footer. Share the real generated PDF through the platform share sheet.

## Checkout and transfers

Checkouts preserves source search/empty/error/selection/expansion and captured row-tap flags. Single return prefers its known row/column, otherwise asks for a target cell. Bulk resolves every required target before sending anything; cancel sends nothing. Then lock returning IDs and send sequentially in selection order, retain failed IDs, reload, and show the source total/partial notice. No extra confirmation is inserted.

Location transfer defaults source and target to the first block. Source choices include the original localized quantity. Cross-block targets depend on the server capability. Validate the same positive integer/max quantity, block and cell; send the original move, perform the source full target readback, preserve selection on a mismatch and clear/reload only on success.

Product transfer has two product selectors and independently scrolling source/target panes, source used flags, selection maximum100, bidirectional drag handles and resizable divider. Scanned-code ambiguity opens the source candidate picker. Confirm before dispatch; retain a secure32-hex request ID for the same retry and validate all returned codes/target item before publishing the whole response and scrolling the destination. Stock is not independently rewritten by the client.

## Storage, Paddons and archive

Paddons/archive preserve source query/debounce/paging, grouping/images, history, warehouse/kind/date filters and clear actions. Archive dates are calendar dates, without UTC conversion. Android uses the native range dialog; iOS uses convenient native date controls with the same bounds/selection. Archive Back returns to Home.

Paddon creation preserves draft/retry request ID and source warehouse/location/note validation. Details load the full snapshot and history, show real linked-product images and header QR/refresh, and bind put/take, lock/unlock, inspection, archive/delete and print. Mutations carry source expected revision and exact retry intent, reject stale scope and notify the existing Qolip data/catalog runtime.

Mold selection is a full page with source back/discard guard and role dock. Preserve grouped/lazy product reads, exact code scans, unavailable/custody flags, selected-code order,1000 cap, review/details, load/retry and near-end paging. Inline scan uses a real guarded QR/Data Matrix camera, source noDuplicates behavior, haptic/status frame, manual toggle/input/accept and selection review. Do not silently accept an unavailable member of a set.

Inspection compares exact expected/scanned codes, supports the shared raw scan/manual dialog and retains source non-dismissible barrier/save behavior. Confirmation, QR and expired-account overlays use their source titles/bodies/button order; expired storage dialogs show only session_changed. Archive details preserve all three kinds, snapshot grouping, mold/paddon QR surfaces, source restore confirmation/revision rules and the narrow server compatibility fallback.

## Tasks, Sequence and read-only detail

Compact Tasks loads saved apparatus and the source kind=qolip task window. Limit options are5/10/20/50; search debounces250ms, trims with Dart semantics and lowercases. Keep checked/missing summary, each distinct empty state, order thumbnail/position/apparatus count/customer and the exact attachment action. Re-read order products before opening the locked product spec editor, keep its saved QR step, and notify the source revision afterward.

Warm cache is scoped by original account/token/witness/snapshot generation with source query keys and maximum8 windows. Prepare once from the role root. Live uses the dedicated production-tasks endpoint with exact apparatus/limit/search/epoch/rev/scope/token, native25s pings, ten-second first-message limit, source exponential reconnect without HTTP polling, one repair budget per query/progress and terminal auth clearing. Reconnect/repair history survives background/focus/manual retry; server-canonical apparatus becomes the next HTTP query. Reject Dart int fields encoded as JSON doubles/exponents.

Sequence is read-only for Qolipchi. Reuse native worker apparatus/order lists with source filtering and saved selection, source non-worker live query, exact hint, tap → full detail and long-press → order molds sheet. The molds sheet immediately reads shared sets, deduplicates/sorts first codes, uses source product lookup limit50 and opens a locked spec editor.

Full non-worker detail retains the initial summary while its guarded order read loads. Expand assigned materials/balances and attached molds with source QR/reprint, render expected results, and lazily expand WIP progress facts. Preserve material5s / WIP12s deadlines, revision coalescing, stage taps/history and source retry. Disable worker/admin mutation and stage-history reprint/reactivation controls that an ordinary Qolipchi cannot reach.

## Verification boundary

Source/control/transport tests and JS bundle/type checks do not prove native pixel, gesture, camera or printer parity. The status file records the real test counts, the existing unrelated Admin test failure, source oracle defects, SDK/hardware limits and project D3/D13 exclusions. No simulator or physical device was used.
