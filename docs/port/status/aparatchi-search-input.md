# Worker search input repair

Scope: worker home product-name/order-number search, including the narrow rezka header. Work is on `main` as requested.

## V2 comparison and changes

| V2 source | V4 implementation | Result |
| --- | --- | --- |
| `admin_production_map_orders_worker_window.dart:19–48`: keep raw input separate; commit the normalized server query after 350 ms | `workerSearchInput.ts`, `useWorkerSearchInput.ts`, `WorkerScreen.tsx`, `useWorkerQueue.ts` | Raw edits notify only the search header. Only a committed query updates the queue owner/live connection, without a second debounce. Clear uses the same V2 debounce. |
| `admin_catalog_search_field.dart:92–105`: single-line editable text | `OrdersSearchInput.android.tsx` | Native Compose editor scrolls its single line; the placeholder is separately constrained to one line. Icons no longer overlay 80 dp of internal text padding. |
| `admin_catalog_search_field.dart:135–147,173–199` and `admin_production_map_orders_screen_state.dart:495–511`: expand focused search, retain cut actions, close by unfocusing | `OrdersHeader.tsx`, `OrdersSearchInput.*` | Menu/profile collapse while focused, paddon/peremotka remain, close blurs without erasing the query. |
| Native editing must retain the complete entered string | `SearchTextSync.ts`, `OrdersHeader.tsx` | Delayed React acknowledgements never write older text back to the native editor. Explicit external query replacements and clear still write natively. |

The shared header is also used by preparation, qolip, material and admin views; its input synchronization/layout changes apply there. Their API/state behavior was not changed. V2 and V4 REST/socket search parameters already match and were retained.

## Search performance follow-up

- V2 `admin_production_map_orders_module_pages.dart:1031–1105` uses a lazy row delegate. Previously V4 created every order element and handler in every Android tab before native virtualization, including the observed 890-order queue.
- `WorkerSearchInput` separates draft and query subscriptions. `WorkerSearchHeader` receives each native text edit; `WorkerScreen` receives only the normalized query after the existing 350 ms delay. Same-scope queue updates preserve the draft and timer; read-scope changes replace the store and native search container. The superseded screen-state debounce hook was removed.
- Worker pages pass the unchanged model arrays through the reused generic `OrdersList` data API. Android renders rows inside `FlatList.renderItem`; iOS uses SDK 58 `List.ForEach` recycling. Both preserve fixed headers, stable item keys, action eligibility, thumbnail identity and footer placement. Other callers can continue supplying element children.
- Completed-order matching is memoized by orders, query and limit, with the lower-case query calculated once per filter.
- No dependency, endpoint, response shape, search normalization, queue limit or debounce duration changed.

## Verification

- 101 focused input, header, lazy-list, queue ownership and REST/socket contract tests passed. The 1000-order screen tests create no order elements until the list requests a row; native list adapter tests verify the same boundary on Android and iOS. Store tests verify raw edits publish no queue updates, scope disposal, cancellation and unchanged-query suppression.
- Android and iOS TypeScript checks passed.
- Expo lint passed with the existing `AdminClosedHistoryOwner.tsx:36` dependency warning and no errors.
- Two broader preparation test cases hit their existing Expo UI `createModifier` ESM mock-resolution failures. These are already recorded in `chat-secure.md`; no production preparation code was changed.
- Physical typing/scrolling performance was not verified for this follow-up; the Android inspector was unavailable at the final check. No iOS device verification was performed.

## Surface audit

| Surface | Shared logic | iOS | Android |
| --- | --- | --- | --- |
| Product/name query and clear | V2 normalization/debounce compared; regression tests pass | Existing native toolbar search retained | Single-line Compose editor; native/React echo and focus layout covered by regression tests |
| Rezka toolbar during search | Paddon/peremotka actions retained | Existing native toolbar retained | Focus reclaims menu/profile space; close restores them |
| Row creation while typing/searching | Raw edits isolated; row data/keys/text/action branches retained | Native recycled `List.ForEach` | Native `FlatList.renderItem` |
