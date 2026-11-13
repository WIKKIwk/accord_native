# Worker search input repair

Scope: worker home product-name/order-number search, including the narrow rezka header. Work is on `main` as requested.

## V2 comparison and changes

| V2 source | V4 implementation | Result |
| --- | --- | --- |
| `admin_production_map_orders_worker_window.dart:19–48`: keep raw input separate; commit the normalized server query after 350 ms | `workerSearchInput.ts`, `useWorkerSearchInput.ts`, `WorkerScreen.tsx`, `useWorkerQueue.ts` | Raw edits notify the header and active local preview list. Only a committed query updates the queue owner/live connection, without a second debounce. Clear uses the same V2 server debounce. |
| `admin_catalog_search_field.dart:92–105`: single-line editable text | `OrdersSearchInput.android.tsx` | Native Compose editor scrolls its single line; the placeholder is separately constrained to one line. Icons no longer overlay 80 dp of internal text padding. |
| `admin_catalog_search_field.dart:135–147,173–199` and `admin_production_map_orders_screen_state.dart:495–511`: expand focused search, retain cut actions, close by unfocusing | `OrdersHeader.tsx`, `OrdersSearchInput.*` | Menu/profile collapse while focused, paddon/peremotka remain, close blurs without erasing the query. |
| Native editing must retain the complete entered string | `SearchTextSync.ts`, `OrdersHeader.tsx` | Delayed React acknowledgements never write older text back to the native editor. Explicit external query replacements and clear still write natively. |

The shared header is also used by preparation, qolip, material and admin views; its input synchronization/layout changes apply there. Their API/state behavior was not changed. V2 and V4 REST/socket search parameters already match and were retained.

## Search performance follow-up

- V2 `admin_production_map_orders_module_pages.dart:1031–1105` uses a lazy row delegate. Previously V4 created every order element and handler in every Android tab before native virtualization, including the observed 890-order queue.
- `WorkerSearchInput` separates draft and query subscriptions. `WorkerSearchHeader` receives each native text edit; `WorkerScreen` receives only the normalized query after the existing 350 ms delay. Same-scope queue updates preserve the draft and timer; read-scope changes replace the store and native search container. The superseded screen-state debounce hook was removed.
- Worker pages pass the unchanged model arrays through the reused generic `OrdersList` data API. Android renders rows inside `FlatList.renderItem`; iOS uses SDK 58 `List.ForEach` recycling. Both preserve fixed headers, stable item keys, action eligibility, thumbnail identity and footer placement. Other callers can continue supplying element children.
- Matching indexes are memoized by model arrays and searchable fields; lowercase row text is prepared once per data update.
- No dependency, endpoint, response shape, search normalization, queue limit or debounce duration changed.

## Immediate local results

The user explicitly requested a faster local preview while typing. This adds display behavior beyond V2's pending server search, while retaining the same server protocol and delay.

- `WorkerSearchQueueList` subscribes to normalized draft text only for the active tab. It filters cached name/code/customer text immediately and passes model rows to the existing lazy native lists. `WorkerScreen`, inactive tabs and the queue controller do not subscribe to raw keystrokes.
- Each apparatus list remembers only its last unfiltered model array. Backspace/clear can show those known rows immediately; overlaps use current server metadata. A fresh unfiltered array replaces the retained baseline, and read-scope changes remount the list. Authorization withdrawal drops the retained baseline.
- A server window matching the draft supplies its exact order and hidden-field matches, capped to the selected limit. Local preview rows are not appended to that response. Completed rows retain their prior local name/code/customer filtering rule. Empty messages appear only after the query settles.
- Preview data never updates the canonical queue snapshot, loaded-window identity or persisted cache. Detail views and long-press/preflight cursor getters reject the previous server cursor while a new draft is being shown, retaining fresh point-read validation.

## Verification

- 116 focused input, local-preview, header, lazy-list, queue ownership and REST/socket contract tests passed. They cover immediate matches, backspace/clear, latest metadata, canonical override/hidden-field matches, limits, active-only subscription, 1000-row index reuse and preview detail/long-press/preflight cursor guards on both platforms.
- Android and iOS TypeScript checks passed.
- Expo lint passed with the existing `AdminClosedHistoryOwner.tsx:36` dependency warning and no errors.
- Two broader preparation test cases hit their existing Expo UI `createModifier` ESM mock-resolution failures. These are already recorded in `chat-secure.md`; no production preparation code was changed.
- Connected Android runtime smoke test passed: a known code reduced the active list from 223 rows to one matching row, with the committed server query and parent page props unchanged. The pending server timer was cancelled for the smoke test; the original empty search and 223 rows were restored, and diagnostic state was removed. This checks the real input-store/render path, not a physical keyboard timing measurement. No iOS device verification was performed.

## Surface audit

| Surface | Shared logic | iOS | Android |
| --- | --- | --- | --- |
| Product/name query and clear | V2 normalization/debounce compared; regression tests pass | Existing native toolbar search retained | Single-line Compose editor; native/React echo and focus layout covered by regression tests |
| Rezka toolbar during search | Paddon/peremotka actions retained | Existing native toolbar retained | Focus reclaims menu/profile space; close restores them |
| Row creation while typing/searching | Raw edits isolated; row data/keys/text/action branches retained | Native recycled `List.ForEach` | Native `FlatList.renderItem` |
| Immediate cached matches | Active-list local preview, server replacement, original limits and fresh action reads | Shared preview logic, native recycled rows | Shared preview logic; connected-runtime smoke passed |
