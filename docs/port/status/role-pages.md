# Reusable orders and chat pages

Status: reusable orders and Chat implemented and automatically checked; main integration next. Native phone checks pending.
Branch: `port/role-pages`. Work will be integrated into `main` for the running Expo server after checks.

## Requested UI changes

- Remove the separate preparation home card containing `Ichki homashyo ta’minoti`. It was V2's AppShell subtitle (`preparation_screen.dart:260`), not a control or a business rule. The user explicitly requested this presentation change.
- Reuse the existing worker home presentation for preparation orders, keeping each role's own requests, controllers, permissions and detail actions.
- Make Chat independent of worker routes and usable by any logged-in role, like Profile.

## Orders checkpoint

- Shared `src/shared/orders/OrdersWorkspace.*` owns the existing native navigation/search, iOS machine picker and Android animated machine pager. Roles pass their actual tabs; the shell never adds worker-only completed orders.
- Shared `OrdersList.*`, `OrderListItem.*` and `OrdersHeader` preserve the existing row layout, colours, image loading and scrolling. Existing worker component imports are compatibility adapters, so both roles use the same implementations.
- Both preparation sequence views use the common presentation with their existing `PreparationOrdersState`, live/paged requests and formula-specific order details. No worker production actions are exposed to preparation.
- The common Android row accepts the same optional status props as iOS/default, eliminating the prior WorkerScreen row-props type mismatch as part of unifying its API. Other Android baseline errors remain outside this task.

## Verification

- Final branch checks: all 1018 tests passed; iOS/default TypeScript and Expo lint passed. Android TypeScript reports only the 9 existing worker errors listed below.
- Expo production JavaScript exports for both iOS and Android passed (`--no-minify --no-bytecode`, two Metro workers). Output is `/tmp/accord-role-pages-native-export`; this verifies bundling, not native device rendering.
- Orders checkpoint: 134 preparation tests, iOS/default TypeScript and lint passed. Android reported only its 9 remaining pre-existing worker errors after the row API was unified. Commit `ffa9780`.
- Shared route tests verify arbitrary role bases, opaque conversation IDs, worker/preparation tab separation, session-scoped metadata and ignoring conversation data arriving after leaving a role.
- Existing drawer tests were updated to assert the now-enabled Chat destination and its platform-specific route. No assertion was removed. The recent-photo preview test now loads the actual shared preview implementation after its extraction; its assertions are unchanged.
- No simulator, emulator or real device was used. No real messages or production requests were sent during verification.

## Chat checkpoint

- Conversation-list and directory state moved unchanged out of the iOS views into shared hooks. Navigation callbacks replace the hard-coded worker paths. Both platforms use the same API, live subscriptions, outbox and media helpers.
- Shared route pages and provider accept a session and route base, with account-scoped metadata. Existing worker route files are small adapters. Preparation iOS has a Chat native tab, its drawer entry is enabled on both platforms, and Android worker/preparation use the common session-guarded route.
- Added real Android conversation list, directory and thread views to replace the old fallback placeholders for native users. Text, outbox retries, read receipts, older messages and image/video/file uploads use existing shared logic.
- Preserved the existing iOS thread/recent-photo animation code. Its preview became a shared React Native component with platform icon names.

## Open items

- Native gestures, keyboard, permissions, photo/video handling and the tab hiding/restoring during Chat navigation require real-device validation.
- Android full-project TypeScript still has 9 existing errors in `WorkerOutputProgress.android.tsx` and `WorkerPaintPalette.android.tsx`. No errors in this scope remain.
- The Android text/media UI uses the shared domain behavior but does not reproduce iOS-only recent-photo flight animations. No voice-recorder feature or new dependency was added; this request reuses the existing Chat feature scope.

## Surface audit

| Surface | Shared implementation | Comparison |
|---|---|---|
| Worker orders native home | `OrdersWorkspace.*`, `OrdersList.*`, `OrderListItem.*` | Existing native source extracted with compatibility adapters; controller and command paths remain worker-owned. |
| Preparation sequence | Shared orders UI + existing `PreparationSequence.*` detail logic | Uses preparation-only tabs/readers and formula actions; no worker production actions added. |
| Preparation home subtitle | `PreparationHome.ios.tsx` | V2 AppShell subtitle had been made a separate Section. Removed per explicit user request. |
| iOS Chat list/directory/thread | Existing native views + `shared/chat` state/navigation | Worker route literals removed; existing iOS thread/composer behavior retained. |
| Android Chat | Native views + existing shared API/outbox/media/thread hooks | Replaced native fallback placeholders. Device presentation remains unverified. |
