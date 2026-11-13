# Worker search input repair

Scope: worker home product-name/order-number search, including the narrow rezka header. Work is on `main` as requested.

## V2 comparison and changes

| V2 source | V4 implementation | Result |
| --- | --- | --- |
| `admin_production_map_orders_worker_window.dart:19–48`: keep raw input separate; commit the normalized server query after 350 ms | `useWorkerQueueSearch.ts`, `WorkerScreen.tsx`, `useWorkerQueue.ts` | Typing keeps the current queue owner/live connection. The committed query starts without a second debounce. Clear uses the same V2 debounce. |
| `admin_catalog_search_field.dart:92–105`: single-line editable text | `OrdersSearchInput.android.tsx` | Native Compose editor scrolls its single line; the placeholder is separately constrained to one line. Icons no longer overlay 80 dp of internal text padding. |
| `admin_catalog_search_field.dart:135–147,173–199` and `admin_production_map_orders_screen_state.dart:495–511`: expand focused search, retain cut actions, close by unfocusing | `OrdersHeader.tsx`, `OrdersSearchInput.*` | Menu/profile collapse while focused, paddon/peremotka remain, close blurs without erasing the query. |
| Native editing must retain the complete entered string | `SearchTextSync.ts`, `OrdersHeader.tsx` | Delayed React acknowledgements never write older text back to the native editor. Explicit external query replacements and clear still write natively. |

The shared header is also used by preparation, qolip, material and admin views; its input synchronization/layout changes apply there. Their API/state behavior was not changed. V2 and V4 REST/socket search parameters already match and were retained.

## Verification

- 91 focused input, header, debounce, queue ownership and REST/socket contract tests passed; the separate preparation header compatibility test also passed (92 total).
- Android and iOS TypeScript checks passed.
- Expo lint passed with the existing `AdminClosedHistoryOwner.tsx:36` dependency warning and no errors.
- Two broader preparation test cases hit their existing Expo UI `createModifier` ESM mock-resolution failures. These are already recorded in `chat-secure.md`; no production preparation code was changed.
- Metro compiled the new Android header/input successfully. The connected Android runtime continued exposing the old input after reload requests, so physical typing/visual verification was not completed. No iOS device verification was performed.

## Surface audit

| Surface | Shared logic | iOS | Android |
| --- | --- | --- | --- |
| Product/name query and clear | V2 normalization/debounce compared; regression tests pass | Existing native toolbar search retained | Single-line Compose editor; native/React echo and focus layout covered by regression tests |
| Rezka toolbar during search | Paddon/peremotka actions retained | Existing native toolbar retained | Focus reclaims menu/profile space; close restores them |
