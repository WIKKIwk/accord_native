# Reusable orders and chat pages

Status: orders UI extracted; chat generalization in progress.
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

Pending final checks. No simulator, emulator or real device was used.

## Open items

Chat extraction and connection are the next checkpoint. Native gestures, keyboard and media presentation require real-device validation.
