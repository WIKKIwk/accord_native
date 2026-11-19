# Admin V2 → V4

V2 reference `052655a427e0`. V4 starting point `77048e680a93`. Android is the current UI scope. Shared logic and the iOS bundle remain part of verification. The neighboring `port-analysis/REPORT.md` and the Admin port ledger supply the inventory. Work stays on the current checkout.

A partial entry has a route, implementation, or tag to check against V2. Missing means this inventory found no direct V4 counterpart. Each unchecked box still needs a caller, UI, or behavior check. Endpoint evidence alone establishes a transport match at most.

## Android work

- [x] Item Groups list and tab checkpoint. Replace the standalone tab strip, pager, and unkeyed item scroll with the Worker workspace and list. Retain the Admin and Brigader callers, native picker result, dialog controls, exact labels, and permission gates.
- [ ] Warehouses. Audit Available/Reserved pages, product and warehouse filtering, stock rows, pagination, and the live refresh lifecycle.
- [ ] Users, Activity, Roles, and Work Map. Audit every tab, inline filter, paged list, action and sheet against its V2 source.
- [ ] Quick Orders, Open Order, and Factory Map. The Admin shortcuts are registered. Reuse the corresponding Brigader feature implementations after checking capability and session ownership.
- [ ] Check all remaining entries in the role inventory below.

## Item Groups mapping

| V2 widget or behavior | V4 implementation |
| --- | --- |
| AppShell, native navigation and dock | AdminLayout, AdminScreenHeader and AdminShellBodyFrame from the existing route; keep the Brigader route adapter |
| AdminSurfaceTabBar and TabBarView | OrdersWorkspace (§5.1), with Tree and Items, controlled selection and swipe |
| Tree ListView, card and expandable tree | OrdersList with a single grouped tree body; retain the tree panel's nodes, connector and shape |
| Items ListView and selected group card | OrdersList keyed item rows within the existing grouped header/rows/footer; use original DP and theme tokens |
| Pull-to-refresh and scroll paging | OrdersList onRefresh and remaining scroll distance; controller owns request and lifecycle checks |
| Expandable filter, loaders, error and empty copy | Inline FilterChip, existing V2-matched progress states, and existing locale keys |
| FAB, create/move forms, and picker result | Existing AdminCreateMenu/RoleFab, native form body with the source field geometry, and WorkerOrderSheet/PickerSheetContent |
| Text and surfaces | AdminText and device Material colors |

- [x] Tree selection changes to Items once and loads offset zero; this also works after an external tab change.
- [x] Refresh tree + eligible parents together. Refresh Items resets only the current group's page.
- [x] Paging starts at 420 dp remaining and uses 40 records per page; preserve duplicate codes and already loaded records on append failure.
- [x] Existing Item Groups tests cover stale page results, retired sessions, focus, picker cancellation, and create/move validation and notices. The customer policy tests cover exact ancestor traversal and cycles.
- [x] Check V2 cases in `test/admin_item_group_refresh_test.dart` and `test/admin_item_group_customer_policy_test.dart`.

### Item Groups verification

- The Android Admin and Brigader item-group entry points still supply their own dock and account authority. No separate Admin implementation was added.
- The tab host uses its 48 dp default; V2 used 38 dp. The tree panel and selected group card retain their existing geometry. The success fallback uses the device palette.
- The keyed list uses the V2 index and code together because the server can repeat a code across pages.
- 56 focused tests, both platform type checks, changed-file ESLint, and both Expo exports passed. Plain `tsc --noEmit` does not resolve platform-only imports with the root config. No Android device or emulator was available.

## Activity mapping

| V2 widget or behavior | V4 implementation |
| --- | --- |
| AppShell, AdminDock and clear confirmation | AdminScreenHeader, AdminShellBodyFrame, owning dock and existing AdminActivityPending confirmation |
| ListView.builder and AppRefreshIndicator | OrdersList keyed rows and onRefresh, with the scoped Activity busy state |
| AdminSummaryCard and activity badge | Existing WorkerQueueCard with Activity alignment, segment corners and status metadata |
| AppLoadingIndicator, AppRetryState and empty view | AdminLoadingIndicator and existing centered text/retry with source dimensions and localized copy |

- [x] Keep server order, all dispatch statuses, hidden IDs, deferred clear confirmation and first-load error/empty behavior.

Activity checkpoint: 56 focused tests, both platform type checks, changed-file lint and the iOS export passed. The existing dispatch API and confirmation controller are the source of truth for the list. Android device verification remains open.

## Roles mapping

| V2 widget or behavior | V4 implementation |
| --- | --- |
| AdminShell and AdminDock | Existing Admin header, body frame and settings dock |
| AdminSurfaceTabBar, TabBarView and both ListViews | OrdersWorkspace with keyed OrdersList pages and shared pull-to-refresh |
| Role and assignment rows, capability disclosure | Existing Compose role tile with source segment geometry, summary, disclosure and assignment handlers |
| Initial loading, retry and background reload | AdminLoadingIndicator, the existing localized retry action and native 2 dp progress indicator |
| Role editor and assignment modal results | Existing owned sheets and AdminRolesController; retain post-dismissal writes, field and apparatus validation |

- [x] Verify source tab order, swipe, refresh on both lists, native sheet lifecycle and the seven initial requests with existing limits.

Roles checkpoint: 29 focused tests, both platform type checks, changed-file lint and the iOS export passed. The shared 48 dp tabs replace the source 38 dp tabs. Existing role sheets and server writes still use the same controller. Android device verification remains open.

## Warehouses mapping

| V2 widget or behavior | V4 implementation |
| --- | --- |
| AdminShell, warehouse search field and AdminDock | Existing warehouse shell and controller-owned search, routed with the guarded Admin drawer and settings dock |
| Products/Settings TabBarView | OrdersWorkspace with horizontal swipe; preserve the Material States preset and Werka single page |
| Available/Reserved AdminSurfaceTabBar inside the scrolling list | OrdersWorkspace selection without horizontal swipe, tab strip follows vertical scroll; reserved appears only when stock or reservations exist |
| Warehouse list and page extent | OrdersList keyed entries, 420 dp pagination, available list reset point and persisted warehouse unchanged |
| Warehouse filter, stock detail cards, sections and overlays | Existing inline filter, existing source-specific row composition and the existing warehouse detail, roll and QR sheet owners |
| Retry and loading | Source summary, item and page retry callbacks, with existing Admin loader |

- [x] Wire the existing warehouse screen to the Admin drawer on Android using the V2 capability gate.
- [x] Check Products/Settings swipe, Available/Reserved selection and the unchanged Werka/Material/Brigader presets.
- [x] Verify retained filter, query paging, reserved-row routing and stale-snapshot protections.

Warehouses checkpoint: 310 focused tests, both platform type checks, changed-file lint and the iOS export passed. The Warehouse transport tests use the real order-note parser. The shared tabs use their 48 dp height. Android device verification remains open.

## Factory Map mapping

| V2 widget or behavior | V4 implementation |
| --- | --- |
| AdminShell with drawer, profile and home dock | AdminScreenHeader, AdminShellBodyFrame and AdminBottomBar |
| Factory map viewport and animation-complete loading | Existing AdminFactoryMapViewer with bundled model, reused factory controller and native transition lifecycle |
| Mapping notice, model retry and overlay controls | Existing map status, retry and camera/labels/refresh controls |
| Attach, machine, order and unlink surfaces | Existing factory presentation owner, resizable sheets, and canonical apparatus mutation guards |
| Live and stock updates | Existing FactoryMapBindings, FactoryMapLive and FactoryMapStock under the original account lifetime |

- [x] Connect Factory Map to the Android Admin home shortcut under the original route permission and session.
- [ ] Verify model mounting, bind/unbind and live order sheets on a device with a test account.

Factory Map checkpoint: 76 focused route and role tests, both platform type checks, changed-file lint and the iOS export passed. The existing map flow supplies Admin's renderer, lifecycle and sheets. The remaining Factory Map item requires a device with the app connected to a test account.

## Quick Orders and Open Order mapping

| V2 widget or behavior | V4 implementation |
| --- | --- |
| Admin drawer, native header, profile and dock | Shared Admin frame with OrdersHeader search on Quick Orders |
| Template ListView, segmented order row and empty/error states | OrdersList, existing template row and localized empty/error presentation |
| Template selection, deletion and private Calculate arguments | Existing CalculateOrderTemplateStore and session-bound flow registry with Admin route admission |
| Calculate inputs, result, locks and order submission | Existing Calculate controller, field/dialog presenters, mutation guards and idempotent API wrappers |
| Attach production map, return result and material catalog | Existing map editor/result owner and calculation materials controller |
| Create a product from the catalog picker | Existing native item-create flow depends on AccordAdminPresentation. This path stays held in Expo Go. |

- [x] Connect both Android shortcuts to the existing controllers and apply V2 route gates, loading/error handling and saved template results.
- [x] Verify the private flow registry cannot adopt stale, foreign or unauthorized arguments. Verify formula and template tests.
- [ ] Verify a complete order with backend data on an authorized test account. Native item creation from the picker remains open.

Quick Orders and Open Order checkpoint: 94 targeted tests, both platform type checks, changed-file lint and the iOS export passed. The Admin calculation routes use the V2 template and production-map result contracts already ported in V4. The materials route uses the existing native SnackbarHost for messages in Expo Go. The original catalog-create action requires AccordAdminPresentation and stays held. Verify the full live submission on a device.

## Ish xaritasi mapping

| V2 widget or behavior | V4 implementation |
| --- | --- |
| TabBar and TabBarView with sequence, orders, move, closed and audit | The Android Worker OrdersWorkspace with the source labels, order and swipe. Keep one active V4 data window and retire stale selection callbacks. |
| Sequence apparatus selector and total | Worker DropdownFilter and AdminText count using the existing apparatus catalog and selection callback |
| Long-press edit/reset and M3SequenceList | DropdownFilter option long press, useNativeSheet, WorkerSheetButton, BrigaderSequenceList and the scoped V2 display-order store |
| Sequence, pending and opened order rows | OrdersList keyed rows, OrderListItem with the sequence rank and thumbnail, and the existing WorkerQueueCard pending row |
| Closed and Audit lists and cards | OrdersList keyed rows and WorkerQueueCard, preserving passive controls, counts and retry |
| Closed ExpansionTile, deferred history and per-log details | Existing scoped AdminClosedHistoryOwner embedded in WorkerQueueCard, shared native sheet with targeted dismissal |
| Move panes, selection and loading | Retain the existing resizable pair and native sheet owner; adapt panes to OrdersList and picker to PickerSheetContent |
| Search, detail sheet, initial and refresh states | Existing OrdersHeader, native order sheet and Worker queue progress, with original session and view tickets |

- [x] Confirm that the Android entry opens the Worker-derived tab, filter, row, list and picker components.
- [x] Keep selection, pending/opened order routing, read/refresh scope, cursor, retry and Move split behavior.
- [x] Port the source's apparatus-filter order editor, reset, refreshed-catalog reconciliation and account retirement behavior.
- [x] Verify the Closed history admission from the actual Android route and the original sheet's targeted dismissal.
- [ ] Complete the source's inactive-window cache, sequence and Move writes, expanded-row retention and QR copy in their dedicated contracts.

Ish xaritasi checkpoint: 258 focused tests, both platform type checks, changed-file ESLint, and both Expo exports passed. Android uses the Worker tab height and dropdown presentation. Sequence and orders use the Worker's staged thumbnail loading. The list requests at most one page per gesture at the source's strict 400 dp threshold. The existing Work Map data owner still loads only the selected module. The connected phone did not complete an inspector query, so native gesture and visual verification remain open.

Apparatus filter checkpoint. The profile-local store preserves selection during editing and reconciles removed, renamed and new machines on save. The ported source scenarios are covered by the Android component callbacks and scoped storage tests. Both Expo exports, configured platform type checks and changed-file ESLint passed. Physical drag and iOS editor presentation remain to be checked.

Closed history checkpoint. 280 focused tests, both configured platform type checks, changed-file ESLint and both Expo exports passed. The source detail reader and scoped window owner are connected to Android Work Map. Exact sheet dismissal preserves a newer route when the history authority retires. Physical-device and iOS route interaction remain open.

## Factory Locations and Inactive Suppliers list mapping

| V2 widget or behavior | V4 implementation |
| --- | --- |
| Factory Locations list, segmented location and empty/create action | OrdersList keyed locations, existing WorkerQueueCard and WorkerSheetButton |
| Factory location loading/retry, editor and actions | AdminLoadingIndicator, WorkerSheetButton and original location owners |
| Inactive Suppliers ListView.separated and AppRefreshIndicator | OrdersList keyed supplier cards with V2 scroll-extent refresh guard |
| Supplier SoftCard, status, restore and unblock | WorkerQueueCard with source spacing, device palette and the existing guarded action controls |

- [x] Verify initial loading, empty, retry, refresh, row identity and the original edit/restore actions.

Secondary lists checkpoint. 109 targeted tests, both configured platform type checks, changed-file ESLint and both Expo exports passed. Inactive Suppliers retains the source's scroll-extent refresh rule using two optional OrdersList callbacks. Native Android interactions and the iOS list presentation remain to be checked.

## Users and item catalog list mapping

| V2 widget or behavior | V4 implementation |
| --- | --- |
| Users catalog search field | OrdersHeader with localized controls, original account action and caller-owned debounce |
| Users role filter and item group filter | Keep the existing expanded Compose FilterChip groups required by §5.1 |
| User and item ListView rows, refresh and pagination | OrdersList keyed rows, preserving the Users viewport-based prefetch and the Catalog 420 dp scroll rule, hidden refresh indicator and measured tail |
| Segmented user and catalog rows | WorkerQueueCard with existing Admin row content, animation, separate item selection and detail actions |

- [x] Verify role and group filters, scroll resets, exact paging inputs, refresh, selection and guarded navigation bindings.
- [ ] Admin Users and item creation admission require the original Hub destinations and native presentation capability. Bundled route checks can exercise the existing Android UI contracts.

Users and item catalog checkpoint. 258 focused tests, configured Android and iOS type checks, ESLint, and both Expo exports passed. Rechecked the original window and session guards against the updated Android list contracts. Android device gestures and the iOS catalog UI remain to be checked.

## Apparatus and warehouse roll sheets

| V2 widget or behavior | V4 implementation |
| --- | --- |
| Factory apparatus selection, search, headings and confirm | PickerSheetContent with its OrdersList, passive group headings, original multi-selection and a WorkerSheetButton; keep the WorkerOrderSheet result owner |
| Warehouse roll ListView.separated and segmented rows | OrdersList and WorkerQueueCard, preserving original spacing, roll identity and nested details |

- [x] Verify search, toggle and confirm, passive headings, roll detail selection, loading and close.

Apparatus and roll sheets checkpoint. 370 focused tests, configured platform type checks, changed-file ESLint and both Expo exports passed. The shared picker exposes group headings and confirmation for the factory caller. Android device sheet gestures and corresponding iOS UI work remain open.

## Decisions

- Existing V4 components may fill a listed gap when V2 behavior is preserved. Retry surfaces can use FeatureError, cards can use the mapped card composition, and metadata/status/actions can use their mapped role components where those contracts fit.
- TwoPaneTransfer requires arbitrary panes and resizing. Check the existing Work Map and apparatus transfer implementations against the V2 contract before changing it. Record any behavior with no equivalent.
- Firebase/push, Iroh/LAN transport and web/desktop are outside this port. No V2 data migration.

## Route and capability checklist

- [ ] `materialHome` (guards: gscale.catalog.read, gscale.print, rps.batch.manage, catalog.item.create, raw_material.assign). partial — `src/material/MaterialHome.android.tsx`, `src/material/MaterialHome.ios.tsx`.
- [ ] `materialHistory` (guards: gscale.catalog.read, gscale.print, rps.batch.manage, catalog.item.create, raw_material.assign). partial — `src/material/MaterialHistory.android.tsx`, `src/material/MaterialHistory.ios.tsx`.
- [ ] `inventoryMovements` (guards: inventory.movement.manage). partial — `src/components/WorkerInventoryScreen.android.tsx`, `src/components/WorkerInventoryScreen.ios.tsx`.
- [ ] `materialTasks` (guards: raw_material.assign). partial — `src/material/MaterialSequence.android.tsx`, `src/material/MaterialSequence.ios.tsx`.
- [ ] `adminHome` (guards: admin.access, role.capability.read, role.capability.manage, admin.settings.read, admin.settings.manage, catalog.item.read, catalog.item.create, catalog.item_group.read, catalog.item_group.manage, catalog.item.bulk_move, party.supplier.read, party.supplier.manage, party.supplier.item.assign, party.supplier.code.manage, party.customer.read, party.customer.manage, party.customer.item.assign, party.customer.code.manage, admin.activity.read, werka.code.manage, production.map.manage, factory.location.manage, inventory.movement.manage, raw_material.rule.manage, raw_material.assign, rezka.split.manage). partial — `src/app/android-admin/index.tsx`.
- [ ] `adminActivity` (guards: admin.activity.read). partial — `src/app/android-admin/activity.tsx`.
- [ ] `adminCalculate` (guards: admin.access, production.map.manage, production.order.create, production.order.edit). partial — `src/app/android-admin/calculate.tsx`.
- [ ] `adminCalculateMaterials` (guards: admin.access, production.map.manage). partial — `src/brigader/brigaderCalculateMaterialsModel.ts`.
- [ ] `adminCalculateOrders` (guards: admin.access, production.map.manage, production.order.create). partial — `src/app/android-admin/calculate-orders.tsx`.
- [ ] `adminCreateHub` (guards: admin.access, catalog.item.create, catalog.item_group.manage, party.supplier.manage, party.customer.manage, werka.code.manage, role.capability.manage). missing — no direct V4 counterpart identified.
- [ ] `adminSettings` (guards: admin.settings.read). partial — `src/admin/AdminManagementRoutes.tsx`.
- [ ] `adminAdditionalSettings` (guards: admin.access). partial — `src/admin/AdminManagementRoutes.tsx`.
- [ ] `adminPushConfig` (guards: admin.settings.read). partial — `src/admin/AdminPushConfigScreen.android.tsx`, `src/admin/AdminPushConfigScreen.ios.tsx`.
- [ ] `adminTraining` (guards: admin.access, production.map.manage). missing — no direct V4 counterpart identified.
- [ ] `adminEmergencyReset` (guards: admin.access). missing — no direct V4 counterpart identified.
- [ ] `adminTelegram` (guards: admin.settings.read). missing — no direct V4 counterpart identified.
- [ ] `adminRoles` (guards: role.capability.read). partial — `src/admin/AdminManagementRoutes.tsx`.
- [ ] `adminNotifications` (guards: admin.access, production.map.manage). missing — no direct V4 counterpart identified.
- [ ] `adminProductionMapTest` (guards: admin.access, production.map.manage, production.map.edit). missing — no direct V4 counterpart identified.
- [ ] `adminProductionMapOrders` (guards: admin.access, production.map.manage, production.map.read). partial — `src/app/android-admin/work-map.tsx`.
- [ ] `adminOpeningWip` (guards: admin.access, production.map.manage). missing — no direct V4 counterpart identified.
- [ ] `supplySequence` (guards: qolip.manage, raw_material.assign, preparation.access). partial — `src/material/MaterialSequence.android.tsx`, `src/material/MaterialSequence.ios.tsx`.
- [ ] `adminProgressQrScan` (guards: admin.access, production.map.manage, apparatus.queue.read, apparatus.queue.manage). missing — no direct V4 counterpart identified.
- [ ] `adminServerMonitor` (guards: admin.access). missing — no direct V4 counterpart identified.
- [ ] `adminFactoryMap` (guards: admin.access). partial — `src/app/android-admin/factory-map.tsx`.
- [ ] `adminFactoryLocations` (guards: factory.location.manage). partial — `src/admin/FactoryLocationsRoute.android.tsx`, `src/admin/FactoryLocationsRoute.ios.tsx`.
- [ ] `adminWipBatches` (guards: admin.access, production.map.manage). missing — no direct V4 counterpart identified.
- [ ] `adminQueuePolicies` (guards: admin.access, production.map.manage). partial — `src/admin/AdminManagementRoutes.tsx`.
- [ ] `adminApparatusSettings` (guards: admin.access, production.map.manage). missing — no direct V4 counterpart identified.
- [ ] `adminApparatusGroups` (guards: admin.access, production.map.manage). partial — `src/app/android-brigader/apparatus-groups.tsx`.
- [ ] `adminRawMaterialSettings` (guards: raw_material.rule.manage, raw_material.assign). missing — no direct V4 counterpart identified.
- [ ] `adminRawMaterialRules` (guards: raw_material.rule.manage). partial — `src/app/android-brigader/raw-material-rules.tsx`.
- [ ] `adminRawMaterialAssignments` (guards: raw_material.assign). partial — `src/app/android-brigader/raw-material-assignments.tsx`.
- [ ] `adminApparatusCreate` (guards: admin.access, production.map.manage). partial — `src/app/android-brigader/apparatus-create.tsx`.
- [ ] `adminSuppliers` (guards: party.supplier.read, party.customer.read). partial — `src/app/android-admin/users.tsx`.
- [ ] `adminWorkerSettings` (guards: admin.access). partial — `src/rezka/rezkaWorkerController.ts`.
- [ ] `adminWarehouses` (guards: catalog.item.read, catalog.item_group.read, raw_material.assign). partial — src/admin/AdminWarehouseMainScreen.android.tsx.
- [ ] `adminUserCreate` (guards: party.supplier.manage, party.customer.manage, werka.code.manage). partial — `src/admin/AdminUserCreateScreen.android.tsx`, `src/admin/AdminUserCreateScreen.ios.tsx`.
- [ ] `adminSupplierCreate` (guards: party.supplier.manage). missing — no direct V4 counterpart identified.
- [ ] `adminCustomerCreate` (guards: party.customer.manage). missing — no direct V4 counterpart identified.
- [ ] `adminCustomerDetail` (guards: party.customer.read). partial — src/admin/AdminUsersScreen.android.tsx.
- [ ] `adminWorkerDetail` (guards: admin.access). partial — src/admin/AdminUsersScreen.android.tsx.
- [ ] `adminWorkerProfileDetail` (guards: admin.access). partial — `src/admin/adminOwnedRoutes.ts`.
- [ ] `adminInactiveSuppliers` (guards: party.supplier.read). partial — `src/admin/AdminManagementRoutes.tsx`.
- [ ] `adminItemCreate` (guards: catalog.item.read, catalog.item.create, catalog.item.bulk_move). partial — `src/admin/AdminItemCreateScreen.android.tsx`, `src/admin/AdminItemCreateScreen.ios.tsx`.
- [ ] `adminItemDetail` (guards: admin.access). partial — `src/admin/AdminItemCreateScreen.android.tsx`, `src/admin/AdminItemCreateScreen.ios.tsx`.
- [ ] `adminItemGroupCreate` (guards: catalog.item_group.manage). partial — `src/admin/AdminManagementRoutes.tsx`.
- [ ] `adminItemBulkMove` (guards: catalog.item.bulk_move). partial — `src/admin/AdminItemCreateScreen.android.tsx`, `src/admin/AdminItemCreateScreen.ios.tsx`.
- [ ] `adminSupplierDetail` (guards: party.supplier.read). partial — src/admin/AdminUsersScreen.android.tsx.
- [ ] `adminSupplierItemsView` (guards: party.supplier.item.assign). partial — `src/admin/adminOwnedRoutes.ts`.
- [ ] `adminSupplierItemsAdd` (guards: party.supplier.item.assign). partial — `src/admin/adminOwnedRoutes.ts`.
- [ ] `adminWerka` (guards: werka.code.manage). partial — `src/admin/AdminWerkaScreen.android.tsx`, `src/admin/AdminWerkaScreen.ios.tsx`.

## Screen, sheet, and dialog checklist

- [ ] sheet `RpsQrReprintSheet` (`lib/src/core/widgets/feedback/rps_qr_reprint_sheet.dart:17`). partial — `src/gscale/MaterialArchive.ios.tsx`, `src/preparation/PreparationProduction.android.tsx`.
- [ ] screen `AdminActivityScreen` (`lib/src/features/admin/presentation/admin_activity_screen.dart:18`). partial — src/admin/AdminActivityScreen.android.tsx.
- [ ] screen `AdminAdditionalSettingsScreen` (`lib/src/features/admin/presentation/admin_additional_settings_screen.dart:18`). partial — `src/admin/AdditionalSettingsScreen.android.tsx`, `src/admin/AdditionalSettingsScreen.ios.tsx`.
- [ ] screen `AdminApparatusDetailScreen` (`lib/src/features/admin/presentation/admin_apparatus_detail_screen.dart:21`). missing — no direct V4 counterpart identified.
- [ ] screen `AdminApparatusSettingsScreen` (`lib/src/features/admin/presentation/admin_apparatus_settings_screen_declarations_part_01.dart:17`). missing — no direct V4 counterpart identified.
- [ ] screen `AdminCalculateMaterialsScreen` (`lib/src/features/admin/presentation/admin_calculate_materials_screen_widgets_part_01.dart:4`). partial — `src/brigader/brigaderCalculateMaterialsModel.ts`.
- [ ] screen `AdminCalculateOrdersScreen` (`lib/src/features/admin/presentation/admin_calculate_orders_screen.dart:23`). partial — src/brigader/BrigaderCalculateOrdersContent.tsx (Brigader); src/app/android-admin/calculate-orders.tsx (route only).
- [ ] sheet `_ComboNameDialog` (`lib/src/features/admin/presentation/admin_calculate_screen_combo.dart:127`). missing — no direct V4 counterpart identified.
- [ ] screen `AdminCalculateScreen` (`lib/src/features/admin/presentation/admin_calculate_screen_models_part_01.dart:34`). partial — src/brigader/BrigaderCalculateContent.tsx (Brigader); src/app/android-admin/calculate.tsx (route only).
- [ ] sheet `_QuickOrderRecreateDialog` (`lib/src/features/admin/presentation/admin_calculate_screen_models_part_01.dart:62`). missing — no direct V4 counterpart identified.
- [ ] screen `AdminCreateHubScreen` (`lib/src/features/admin/presentation/admin_create_hub_screen.dart:12`). missing — no direct V4 counterpart identified.
- [ ] screen `AdminCustomerCreateScreen` (`lib/src/features/admin/presentation/admin_customer_create_screen.dart:8`). missing — no direct V4 counterpart identified.
- [ ] screen `AdminCustomerDetailScreen` (`lib/src/features/admin/presentation/admin_customer_detail_screen_declarations_part_01.dart:24`). partial — `src/admin/AdminCustomerDetailScreen.android.tsx`, `src/admin/AdminCustomerDetailScreen.ios.tsx`.
- [ ] sheet `_MaterialItemGroupPickerSheet` (`lib/src/features/admin/presentation/admin_user_create_screen_declarations_part_03.dart:76`). missing — no direct V4 counterpart identified.
- [ ] screen `AdminEmergencyResetScreen` (`lib/src/features/admin/presentation/admin_emergency_reset_screen.dart:11`). missing — no direct V4 counterpart identified.
- [ ] screen `AdminFactoryLocationsScreen` (`lib/src/features/admin/presentation/admin_factory_locations_screen_widgets_part_01.dart:4`). partial — `src/admin/FactoryLocationsRoute.android.tsx`, `src/admin/FactoryLocationsRoute.ios.tsx`.
- [ ] sheet `_FactoryLocationEditorDialog` (`lib/src/features/admin/presentation/admin_factory_locations_screen_widgets_part_02.dart:198`). missing — no direct V4 counterpart identified.
- [ ] sheet `_ApparatusPickerBottomSheet` (`lib/src/features/admin/presentation/admin_factory_locations_screen_widgets_part_02.dart:371`). missing — no direct V4 counterpart identified.
- [ ] screen `AdminFactoryMapScreen` (`lib/src/features/admin/presentation/admin_factory_map_screen_helpers_part_01.dart:28`). partial — src/brigader/BrigaderFactoryMapContent.tsx (Brigader); src/app/android-admin/factory-map.tsx (route only).
- [ ] sheet `_FactoryApparatusLiveSheet` (`lib/src/features/admin/presentation/admin_factory_map_screen_helpers_part_01.dart:520`). missing — no direct V4 counterpart identified.
- [ ] sheet `_FactoryMapAttachSheet` (`lib/src/features/admin/presentation/admin_factory_map_screen_helpers_part_01.dart:540`). missing — no direct V4 counterpart identified.
- [ ] screen `AdminHomeScreen` (`lib/src/features/admin/presentation/admin_home_screen.dart:20`). partial — src/admin/AdminHomeScreen.android.tsx.
- [ ] screen `AdminInactiveSuppliersScreen` (`lib/src/features/admin/presentation/admin_inactive_suppliers_screen.dart:12`). partial — `src/admin/AdminInactiveSuppliersScreen.android.tsx`, `src/admin/AdminInactiveSuppliersScreen.ios.tsx`.
- [ ] screen `AdminItemCreateScreen` (`lib/src/features/admin/presentation/admin_item_create_screen_widgets_part_01.dart:4`). partial — `src/admin/AdminItemCreateScreen.android.tsx`, `src/admin/AdminItemCreateScreen.ios.tsx`.
- [ ] sheet `_ItemGroupPickerSheet` (`lib/src/features/admin/presentation/admin_item_detail_editors.dart:26`). missing — no direct V4 counterpart identified.
- [ ] sheet `_ItemCustomerPickerSheet` (`lib/src/features/admin/presentation/admin_item_detail_editors.dart:155`). partial — `src/admin/AdminItemDetailCustomerContent.android.tsx`, `src/admin/AdminItemDetailCustomerContent.ios.tsx`.
- [ ] sheet `_AdminItemEditDialog` (`lib/src/features/admin/presentation/admin_item_detail_editors.dart:397`). partial — `src/admin/AdminItemDetailDecisionContent.android.tsx`, `src/admin/AdminItemDetailDecisionContent.ios.tsx`.
- [ ] sheet `_ItemDetailActionsSheet` (`lib/src/features/admin/presentation/admin_item_detail_screen_combo.dart:158`). partial — `src/admin/AdminItemDetailActionMenuContent.android.tsx`, `src/admin/AdminItemDetailActionMenuContent.ios.tsx`.
- [ ] screen `AdminItemDetailScreen` (`lib/src/features/admin/presentation/admin_item_detail_screen_helpers_part_01.dart:33`). missing — no direct V4 counterpart identified.
- [ ] screen `AdminItemGroupCreateScreen` (`lib/src/features/admin/presentation/admin_item_group_create_screen_widgets_part_01.dart:4`). partial — src/admin/ItemGroupsRoute.android.tsx.
- [ ] screen `AdminNotificationsScreen` (`lib/src/features/admin/presentation/admin_notifications_screen_widgets_part_01.dart:4`). missing — no direct V4 counterpart identified.
- [ ] sheet `_ApparatusPickerSheet` (`lib/src/features/admin/presentation/admin_production_map_orders_apparatus_picker.dart:3`). missing — no direct V4 counterpart identified.
- [ ] sheet `_ClosedOrderLogDetailsSheet` (`lib/src/features/admin/presentation/admin_production_map_orders_closed_log_sheet.dart:75`). missing — no direct V4 counterpart identified.
- [ ] screen `_ClosedOrdersModulePage` (`lib/src/features/admin/presentation/admin_production_map_orders_closed_widgets.dart:3`). missing — no direct V4 counterpart identified.
- [ ] sheet `_OrderHomashyoPickerSheet` (`lib/src/features/admin/presentation/admin_production_map_orders_detail_widgets.dart:1047`). missing — no direct V4 counterpart identified.
- [ ] sheet `LaminationLayerRemainderSheet` (`lib/src/features/admin/presentation/admin_production_map_orders_layer_remainders.dart:331`). missing — no direct V4 counterpart identified.
- [ ] screen `_OrdersModulePage` (`lib/src/features/admin/presentation/admin_production_map_orders_module_pages.dart:3`). missing — no direct V4 counterpart identified.
- [ ] screen `_WorkflowAuditModulePage` (`lib/src/features/admin/presentation/admin_production_map_orders_module_pages.dart:428`). missing — no direct V4 counterpart identified.
- [ ] screen `_AparatchiWatchSequencePage` (`lib/src/features/admin/presentation/admin_production_map_orders_module_pages.dart:946`). missing — no direct V4 counterpart identified.
- [ ] sheet `_BosmaWorkerFinishSheet` (`lib/src/features/admin/presentation/admin_production_map_orders_module_pages.dart:1135`). partial — `src/components/WorkerLongPressActions.tsx`.
- [ ] sheet `_LaminatsiyaWorkerFinishSheet` (`lib/src/features/admin/presentation/admin_production_map_orders_module_pages.dart:1198`). missing — no direct V4 counterpart identified.
- [ ] sheet `_LaminatsiyaWorkerHandoffSheet` (`lib/src/features/admin/presentation/admin_production_map_orders_module_pages.dart:1468`). missing — no direct V4 counterpart identified.
- [ ] screen `_AparatchiCompletedOrdersPage` (`lib/src/features/admin/presentation/admin_production_map_orders_module_pages.dart:1536`). missing — no direct V4 counterpart identified.
- [ ] screen `_MoveModulePage` (`lib/src/features/admin/presentation/admin_production_map_orders_move_module.dart:3`). missing — no direct V4 counterpart identified.
- [ ] sheet `_ApparatusTransferReasonDialog` (`lib/src/features/admin/presentation/admin_production_map_orders_move_state.dart:25`). missing — no direct V4 counterpart identified.
- [ ] screen `AdminOpeningWipScreen` (`lib/src/features/admin/presentation/admin_production_map_orders_opening_wip.dart:754`). missing — no direct V4 counterpart identified.
- [ ] sheet `_ProgressQtyDialog` (`lib/src/features/admin/presentation/admin_production_map_orders_progress_qty.dart:247`). missing — no direct V4 counterpart identified.
- [ ] screen `_QolipTasksPage` (`lib/src/features/admin/presentation/admin_production_map_orders_qolip_tasks.dart:32`). partial — `src/material/MaterialTasks.android.tsx`.
- [ ] sheet `_ReadOnlyOrderDetailSheet` (`lib/src/features/admin/presentation/admin_production_map_orders_read_only_sheet.dart:3910`). partial — `src/qolip/QolipSequenceOrderDetail.android.tsx`, `src/qolip/QolipSequenceOrderDetail.ios.tsx`.
- [ ] sheet `_ScannedWipHistorySheet` (`lib/src/features/admin/presentation/admin_production_map_orders_scanned_wip.dart:67`). partial — `src/components/WorkerScannedWipHistory.android.tsx`, `src/components/WorkerScannedWipHistory.ios.tsx`.
- [ ] sheet `_EarlyCloseOrderDialog` (`lib/src/features/admin/presentation/admin_production_map_orders_screen_widgets.dart:40`). missing — no direct V4 counterpart identified.
- [ ] screen `AdminProductionMapOrdersScreen` (`lib/src/features/admin/presentation/admin_production_map_orders_screen_widgets.dart:236`). partial — `src/material/MaterialSequence.android.tsx`, `src/material/MaterialSequence.ios.tsx`.
- [ ] sheet `_SequenceRawMaterialAssignmentSheet` (`lib/src/features/admin/presentation/admin_production_map_orders_sequence_assignment_sheet.dart:727`). partial — `src/material/MaterialSequenceAssignment.android.tsx`, `src/material/MaterialSequenceAssignment.ios.tsx`.
- [ ] sheet `_SequenceQolipSheet` (`lib/src/features/admin/presentation/admin_production_map_orders_sequence_qolip_sheet.dart:3`). partial — `src/qolip/QolipSequenceMoldsSheet.android.tsx`, `src/qolip/QolipSequenceMoldsSheet.ios.tsx`.
- [ ] screen `_SequenceModulePage` (`lib/src/features/admin/presentation/admin_production_map_orders_sequence_widgets.dart:3`). missing — no direct V4 counterpart identified.
- [ ] sheet `_StageParticipantsSheet` (`lib/src/features/admin/presentation/admin_production_map_orders_stage_participants.dart:3`). missing — no direct V4 counterpart identified.
- [ ] sheet `_WorkerTemporaryPauseSwitchSheet` (`lib/src/features/admin/presentation/admin_production_map_orders_temporary_pause.dart:128`). partial — `src/components/WorkerSwitchPrompt.android.tsx`, `src/components/WorkerSwitchPrompt.ios.tsx`.
- [ ] sheet `_WorkerFrozenOrderDetailsSheet` (`lib/src/features/admin/presentation/admin_production_map_orders_wip_history_sheet.dart:3`). missing — no direct V4 counterpart identified.
- [ ] sheet `_WorkerWipHistorySheet` (`lib/src/features/admin/presentation/admin_production_map_orders_wip_history_sheet.dart:106`). missing — no direct V4 counterpart identified.
- [ ] sheet `_FormulaEditorSheet` (`lib/src/features/admin/presentation/admin_production_map_test_formula_widgets.dart:224`). missing — no direct V4 counterpart identified.
- [ ] sheet `_NodeEditSheet` (`lib/src/features/admin/presentation/admin_production_map_test_node_edit_sheets.dart:3`). missing — no direct V4 counterpart identified.
- [ ] sheet `_RezkaNodeEditSheet` (`lib/src/features/admin/presentation/admin_production_map_test_node_edit_sheets.dart:12`). missing — no direct V4 counterpart identified.
- [ ] screen `AdminProductionMapTestScreen` (`lib/src/features/admin/presentation/admin_production_map_test_screen.dart:46`). missing — no direct V4 counterpart identified.
- [ ] sheet `_ApparatusGroupPickerSheet` (`lib/src/features/admin/presentation/admin_production_map_test_sheet_widgets.dart:129`). missing — no direct V4 counterpart identified.
- [ ] sheet `_ProductionMapOrderConfirmationDialog` (`lib/src/features/admin/presentation/admin_production_map_test_sheet_widgets.dart:199`). missing — no direct V4 counterpart identified.
- [ ] screen `AdminProgressQrScanScreen` (`lib/src/features/admin/presentation/admin_progress_qr_scan_screen_models_part_01.dart:22`). missing — no direct V4 counterpart identified.
- [ ] screen `AdminPushConfigScreen` (`lib/src/features/admin/presentation/admin_push_config_screen.dart:14`). partial — `src/admin/AdminPushConfigScreen.android.tsx`, `src/admin/AdminPushConfigScreen.ios.tsx`.
- [ ] sheet `_ManualCandidateDetailsSheet` (`lib/src/features/admin/presentation/admin_raw_material_assignment_screen_widgets_part_02.dart:4`). partial — `src/material/MaterialAssignments.ios.tsx`.
- [ ] sheet `_ManualAssignmentDetailsSheet` (`lib/src/features/admin/presentation/admin_raw_material_assignment_screen_widgets_part_02.dart:62`). partial — `src/material/MaterialAssignments.ios.tsx`.
- [ ] screen `AdminRawMaterialSettingsScreen` (`lib/src/features/admin/presentation/admin_raw_material_rules_screen_declarations_part_01.dart:14`). missing — no direct V4 counterpart identified.
- [ ] sheet `_RawMaterialGroupPickerDialog` (`lib/src/features/admin/presentation/admin_raw_material_rules_screen_declarations_part_01.dart:260`). missing — no direct V4 counterpart identified.
- [ ] sheet `_RoleAssignmentSheet` (`lib/src/features/admin/presentation/admin_roles_screen_models_part_03.dart:115`). partial — `src/admin/AdminRolesScreen.android.tsx`, `src/admin/AdminRolesScreen.ios.tsx`.
- [ ] screen `AdminRolesScreen` (`lib/src/features/admin/presentation/admin_roles_screen_widgets_part_01.dart:4`). partial — src/admin/AdminRolesScreen.android.tsx.
- [ ] sheet `_AdminRoleEditorSheet` (`lib/src/features/admin/presentation/admin_roles_screen_widgets_part_02.dart:316`). partial — `src/admin/AdminRolesScreen.android.tsx`, `src/admin/AdminRolesScreen.ios.tsx`.
- [ ] screen `AdminServerMonitorScreen` (`lib/src/features/admin/presentation/admin_server_monitor_screen_widgets_part_01.dart:4`). missing — no direct V4 counterpart identified.
- [ ] screen `AdminSettingsScreen` (`lib/src/features/admin/presentation/admin_settings_screen.dart:13`). partial — `src/admin/AdminSettingsScreen.android.tsx`, `src/admin/AdminSettingsScreen.ios.tsx`.
- [ ] screen `AdminSupplierCreateScreen` (`lib/src/features/admin/presentation/admin_supplier_create_screen.dart:8`). missing — no direct V4 counterpart identified.
- [ ] screen `AdminSupplierDetailScreen` (`lib/src/features/admin/presentation/admin_supplier_detail_screen_widgets_part_01.dart:4`). partial — `src/admin/AdminSupplierDetailScreen.android.tsx`, `src/admin/AdminSupplierDetailScreen.ios.tsx`.
- [ ] screen `AdminSupplierItemsAddScreen` (`lib/src/features/admin/presentation/admin_supplier_items_add_screen.dart:12`). partial — `src/admin/AdminSupplierItemsScreen.android.tsx`, `src/admin/AdminSupplierItemsScreen.ios.tsx`.
- [ ] screen `AdminSupplierItemsViewScreen` (`lib/src/features/admin/presentation/admin_supplier_items_view_screen.dart:12`). partial — `src/admin/AdminSupplierItemsScreen.android.tsx`, `src/admin/AdminSupplierItemsScreen.ios.tsx`.
- [ ] screen `AdminSuppliersScreen` (`lib/src/features/admin/presentation/admin_suppliers_screen_widgets_part_01.dart:4`). partial — src/admin/AdminUsersScreen.android.tsx.
- [ ] sheet `_TrainingOrderDetailsSheet` (`lib/src/features/admin/presentation/admin_training_screen_models_part_03.dart:283`). missing — no direct V4 counterpart identified.
- [ ] sheet `_TrainingMaterialLinkSheet` (`lib/src/features/admin/presentation/admin_training_screen_models_part_04.dart:371`). missing — no direct V4 counterpart identified.
- [ ] screen `AdminTrainingScreen` (`lib/src/features/admin/presentation/admin_training_screen_widgets_part_01.dart:4`). missing — no direct V4 counterpart identified.
- [ ] screen `AdminUserCreateScreen` (`lib/src/features/admin/presentation/admin_user_create_screen_widgets_part_01.dart:4`). partial — `src/admin/AdminUserCreateScreen.android.tsx`, `src/admin/AdminUserCreateScreen.ios.tsx`.
- [ ] sheet `_RawMaterialStockQrSheet` (`lib/src/features/admin/presentation/admin_warehouses_screen_declarations_part_03.dart:112`). partial — `src/admin/AdminWarehouseRawQrSheet.android.tsx`.
- [ ] sheet `_RawMaterialStockEditSheet` (`lib/src/features/admin/presentation/admin_warehouses_screen_declarations_part_03.dart:192`). missing — no direct V4 counterpart identified.
- [ ] sheet `_WarehouseSummaryDetailsSheet` (`lib/src/features/admin/presentation/admin_warehouses_screen_helpers_part_05.dart:27`). missing — no direct V4 counterpart identified.
- [ ] sheet `_WarehouseItemRollsSheet` (`lib/src/features/admin/presentation/admin_warehouses_screen_models_part_04.dart:485`). partial — `src/admin/AdminWarehouseItemRollsSheet.android.tsx`, `src/admin/AdminWarehouseItemRollsSheet.ios.tsx`.
- [ ] screen `AdminWarehousesScreen` (`lib/src/features/admin/presentation/admin_warehouses_screen_widgets_part_01.dart:4`). partial — src/admin/AdminWarehouseMainScreen.android.tsx.
- [ ] screen `AdminWerkaScreen` (`lib/src/features/admin/presentation/admin_werka_screen_widgets_part_01.dart:4`). partial — `src/admin/AdminWerkaScreen.android.tsx`, `src/admin/AdminWerkaScreen.ios.tsx`.
- [ ] screen `AdminWipBatchesScreen` (`lib/src/features/admin/presentation/admin_wip_batches_screen_declarations_part_01.dart:6`). missing — no direct V4 counterpart identified.
- [ ] screen `AdminWorkerDetailScreen` (`lib/src/features/admin/presentation/admin_worker_detail_screen_helpers_part_01.dart:14`). partial — `src/admin/AdminWorkerDetailScreen.android.tsx`, `src/admin/AdminWorkerDetailScreen.ios.tsx`.
- [ ] screen `AdminWorkerProfileDetailScreen` (`lib/src/features/admin/presentation/admin_worker_profile_detail_screen.dart:18`). partial — `src/admin/AdminWorkerProfileScreen.android.tsx`, `src/admin/AdminWorkerProfileScreen.ios.tsx`.
- [ ] screen `AdminWorkerSettingsScreen` (`lib/src/features/admin/presentation/admin_worker_settings_screen_helpers_part_01.dart:146`). partial — `src/rezka/rezkaWorkerController.ts`.
- [ ] sheet `_WorkerApparatusAssignmentSheet` (`lib/src/features/admin/presentation/admin_worker_settings_screen_widgets_part_06.dart:303`). missing — no direct V4 counterpart identified.
- [ ] sheet `PendingOrderDetailSheet` (`lib/src/features/admin/presentation/pending_order_widgets.dart:165`). missing — no direct V4 counterpart identified.
- [ ] sheet `RawMaterialScanDialog` (`lib/src/features/admin/presentation/raw_material_scan_dialog_declarations_part_03.dart:98`). partial — `src/metalayzer/MetalayzerScanner.android.tsx`, `src/metalayzer/MetalayzerScanner.ios.tsx`.
- [ ] sheet `ServerEndpointSwitcherSheet` (`lib/src/features/admin/presentation/server_endpoint_switcher_sheet.dart:12`). missing — no direct V4 counterpart identified.
- [ ] sheet `_AdminMaterialApparatusSheet` (`lib/src/features/admin/presentation/widgets/admin_aparatchi_apparatus_card.dart:345`). missing — no direct V4 counterpart identified.
- [ ] sheet `_AdminWarehousePickerSheet` (`lib/src/features/admin/presentation/widgets/admin_warehouse_picker_sheet.dart:18`). missing — no direct V4 counterpart identified.
- [ ] screen `AdminTelegramScreen` (`lib/src/features/admin/telegram/presentation/admin_telegram_screen_widgets_part_01.dart:4`). missing — no direct V4 counterpart identified.
- [ ] sheet `TelegramBotSettingsSheet` (`lib/src/features/admin/telegram/presentation/telegram_bot_settings_sheet.dart:15`). missing — no direct V4 counterpart identified.
- [ ] sheet `TelegramInviteQrSheet` (`lib/src/features/admin/telegram/presentation/telegram_invite_qr_sheet.dart:9`). missing — no direct V4 counterpart identified.
- [ ] sheet `TelegramUserbotSettingsSheet` (`lib/src/features/admin/telegram/presentation/telegram_userbot_settings_sheet.dart:16`). missing — no direct V4 counterpart identified.
- [ ] sheet `_InventoryAssetQrSheet` (`lib/src/features/inventory/presentation/inventory_movements_screen_declarations_part_02.dart:151`). missing — no direct V4 counterpart identified.
- [ ] sheet `_InventoryTransferDetailsSheet` (`lib/src/features/inventory/presentation/inventory_movements_screen_declarations_part_02.dart:285`). missing — no direct V4 counterpart identified.
- [ ] screen `InventoryMovementsScreen` (`lib/src/features/inventory/presentation/inventory_movements_screen_widgets_part_01.dart:4`). partial — `src/components/WorkerInventoryScreen.android.tsx`, `src/components/WorkerInventoryScreen.ios.tsx`.
- [ ] sheet `_InventoryAssetDetailsSheet` (`lib/src/features/inventory/presentation/inventory_movements_screen_widgets_part_01.dart:112`). missing — no direct V4 counterpart identified.
- [ ] screen `MaterialTaminotchiHistoryScreen` (`lib/src/features/material_taminotchi/presentation/material_taminotchi_home_screen_widgets_part_01.dart:4`). partial — `src/material/MaterialHistory.android.tsx`, `src/material/MaterialHistory.ios.tsx`.
- [ ] screen `MaterialTaminotchiHomeScreen` (`lib/src/features/material_taminotchi/presentation/material_taminotchi_home_screen_widgets_part_01.dart:123`). partial — `src/material/MaterialHome.android.tsx`, `src/material/MaterialHome.ios.tsx`.
- [ ] sheet `WorkerWipDetailsSheet` (`lib/src/features/shared/presentation/widgets/worker_wip_details_sheet.dart:13`). partial — `src/components/WorkerWipBatchDetailsView.android.tsx`.

## State checklist

- [ ] `FactoryMapBindings` (`lib/src/features/admin/logic/factory_map_bindings.dart:14`). partial — `src/admin/factoryMapBindings.ts`.
- [ ] `FactoryMapLive` (`lib/src/features/admin/logic/factory_map_live.dart:12`). partial — `src/admin/factoryMapLive.ts`.
- [ ] `FactoryMapStock` (`lib/src/features/admin/logic/factory_map_stock.dart:15`). partial — `src/admin/factoryMapStock.ts`.
- [ ] `_FormulaAutocompleteController` (`lib/src/features/admin/presentation/admin_production_map_test_formula_widgets.dart:38`). missing — no direct V4 counterpart identified.
- [ ] `OrderImageThumbCache` (`lib/src/features/admin/presentation/widgets/admin_order_image_thumb.dart:135`). missing — no direct V4 counterpart identified.
- [ ] `AdminApparatusFilterOrderStore` (`lib/src/features/admin/state/admin_apparatus_filter_order_store.dart:6`). missing — no direct V4 counterpart identified.
- [ ] `AdminOrderPageCache` (`lib/src/features/admin/state/admin_order_page_cache.dart:45`). missing — no direct V4 counterpart identified.
- [ ] `AdminSequenceApparatusStore` (`lib/src/features/admin/state/admin_sequence_apparatus_store.dart:6`). partial — `src/shared/adminSequenceApparatusStore.ts`.
- [ ] `AdminSequenceWarmStore` (`lib/src/features/admin/state/admin_sequence_warm_store.dart:94`). missing — no direct V4 counterpart identified.
- [ ] `AdminStore` (`lib/src/features/admin/state/admin_store.dart:5`). partial — `src/admin/adminStore.ts`.
- [ ] `AdminUsersRoleStore` (`lib/src/features/admin/state/admin_users_role_store.dart:6`). partial — `src/admin/adminUsersRoleStore.ts`.
- [ ] `AdminWarehouseFilterStore` (`lib/src/features/admin/state/admin_warehouse_filter_store.dart:5`). partial — `src/admin/adminWarehouseFilterStore.ts`.
- [ ] `CalculateOrderTemplateStore` (`lib/src/features/admin/state/calculate_order_store.dart:37`). partial — `src/admin/calculateOrderTemplateStore.ts`.
- [ ] `CalculateOrderTemplateStoreScope` (`lib/src/features/admin/state/calculate_order_store.dart:201`). missing — no direct V4 counterpart identified.
- [ ] `_AdminActivityScreenState` (`lib/src/features/admin/presentation/admin_activity_screen.dart:25`). missing — no direct V4 counterpart identified.
- [ ] `_AdminAdditionalSettingsScreenState` (`lib/src/features/admin/presentation/admin_additional_settings_screen.dart:26`). missing — no direct V4 counterpart identified.
- [ ] `_AdminApparatusCapacityPanelState` (`lib/src/features/admin/presentation/admin_apparatus_capacity_panel.dart:17`). partial — `src/brigader/brigaderCapacityController.ts`.
- [ ] `_AdminApparatusDetailScreenState` (`lib/src/features/admin/presentation/admin_apparatus_detail_screen.dart:52`). missing — no direct V4 counterpart identified.
- [ ] `_AdminApparatusSettingsScreenState` (`lib/src/features/admin/presentation/admin_apparatus_settings_screen.dart:36`). missing — no direct V4 counterpart identified.
- [ ] `_AdminApparatusCollectionGroupCardState` (`lib/src/features/admin/presentation/admin_apparatus_settings_screen__AdminApparatusSettingsScreenState_methods_03.dart:207`). missing — no direct V4 counterpart identified.
- [ ] `_AdminApparatusCanonicalGroupCardState` (`lib/src/features/admin/presentation/admin_apparatus_settings_screen__AdminApparatusSettingsScreenState_methods_03.dart:380`). missing — no direct V4 counterpart identified.
- [ ] `_AdminCalculateMaterialsScreenState` (`lib/src/features/admin/presentation/admin_calculate_materials_screen_widgets_part_01.dart:12`). missing — no direct V4 counterpart identified.
- [ ] `_CalculateMaterialEditorState` (`lib/src/features/admin/presentation/admin_calculate_materials_screen_widgets_part_01.dart:280`). missing — no direct V4 counterpart identified.
- [ ] `_AdminCalculateOrdersScreenState` (`lib/src/features/admin/presentation/admin_calculate_orders_screen.dart:31`). partial — `src/brigader/brigaderCalculateOrdersModel.ts`.
- [ ] `_AdminCalculateScreenState` (`lib/src/features/admin/presentation/admin_calculate_screen.dart:51`). partial — `src/brigader/BrigaderCalculateStore.tsx`.
- [ ] `_ComboNameDialogState` (`lib/src/features/admin/presentation/admin_calculate_screen_combo.dart:133`). missing — no direct V4 counterpart identified.
- [ ] `_CalculateMaterialManagerState` (`lib/src/features/admin/presentation/admin_calculate_screen_models_part_04.dart:4`). missing — no direct V4 counterpart identified.
- [ ] `_AdminCustomerDetailScreenState` (`lib/src/features/admin/presentation/admin_customer_detail_screen.dart:35`). partial — `src/admin/adminCustomerDetailController.ts`.
- [ ] `_MaterialItemGroupPickerSheetState` (`lib/src/features/admin/presentation/admin_customer_detail_screen_declarations_part_01.dart:143`). missing — no direct V4 counterpart identified.
- [ ] `_CustomerPhoneInlineFieldState` (`lib/src/features/admin/presentation/admin_customer_detail_screen_widgets_part_03.dart:278`). partial — `src/admin/useAdminCustomerDetail.ts`.
- [ ] `_AdminEmergencyResetScreenState` (`lib/src/features/admin/presentation/admin_emergency_reset_screen.dart:69`). missing — no direct V4 counterpart identified.
- [ ] `_ApparatusPickerBottomSheetState` (`lib/src/features/admin/presentation/admin_factory_locations_screen_models_part_03.dart:4`). missing — no direct V4 counterpart identified.
- [ ] `_AdminFactoryLocationsScreenState` (`lib/src/features/admin/presentation/admin_factory_locations_screen_widgets_part_01.dart:12`). missing — no direct V4 counterpart identified.
- [ ] `_FactoryLocationEditorDialogState` (`lib/src/features/admin/presentation/admin_factory_locations_screen_widgets_part_02.dart:212`). missing — no direct V4 counterpart identified.
- [ ] `_AdminFactoryMapScreenState` (`lib/src/features/admin/presentation/admin_factory_map_screen_helpers_part_01.dart:41`). partial — `src/brigader/brigaderFactoryMapModel.ts`.
- [ ] `_FactoryMapAttachSheetState` (`lib/src/features/admin/presentation/admin_factory_map_screen_helpers_part_01.dart:557`). missing — no direct V4 counterpart identified.
- [ ] `_FactoryApparatusLiveSheetState` (`lib/src/features/admin/presentation/admin_factory_map_screen_models_part_02.dart:4`). missing — no direct V4 counterpart identified.
- [ ] `_FactoryOrderCardState` (`lib/src/features/admin/presentation/admin_factory_map_screen_models_part_03.dart:4`). missing — no direct V4 counterpart identified.
- [ ] `_FactoryMapObjectPickerState` (`lib/src/features/admin/presentation/admin_factory_map_viewer.dart:211`). missing — no direct V4 counterpart identified.
- [ ] `_AdminHomeScreenState` (`lib/src/features/admin/presentation/admin_home_screen.dart:27`). missing — no direct V4 counterpart identified.
- [ ] `_AdminInactiveSuppliersScreenState` (`lib/src/features/admin/presentation/admin_inactive_suppliers_screen.dart:20`). partial — `src/admin/adminInactiveSuppliersController.ts`.
- [ ] `_AdminItemCreateScreenState` (`lib/src/features/admin/presentation/admin_item_create_screen.dart:32`). partial — `src/admin/adminItemCreateFormController.ts`.
- [ ] `_AdminItemsListTabState` (`lib/src/features/admin/presentation/admin_item_create_screen_models_part_02.dart:4`). partial — `src/admin/adminItemCreateListController.ts`.
- [ ] `_ItemGroupPickerSheetState` (`lib/src/features/admin/presentation/admin_item_detail_editors.dart:39`). missing — no direct V4 counterpart identified.
- [ ] `_ItemCustomerPickerSheetState` (`lib/src/features/admin/presentation/admin_item_detail_editors.dart:171`). partial — `src/admin/adminItemDetailCustomersController.ts`.
- [ ] `_AdminItemEditDialogState` (`lib/src/features/admin/presentation/admin_item_detail_editors.dart:406`). missing — no direct V4 counterpart identified.
- [ ] `_ComboItemDetailViewState` (`lib/src/features/admin/presentation/admin_item_detail_screen_combo.dart:12`). missing — no direct V4 counterpart identified.
- [ ] `_ComboItemProductRowState` (`lib/src/features/admin/presentation/admin_item_detail_screen_combo.dart:287`). missing — no direct V4 counterpart identified.
- [ ] `_AdminItemDetailScreenState` (`lib/src/features/admin/presentation/admin_item_detail_screen_models_part_02.dart:4`). missing — no direct V4 counterpart identified.
- [ ] `_AdminItemGroupBulkMoveTabState` (`lib/src/features/admin/presentation/admin_item_group_bulk_move_screen.dart:21`). missing — no direct V4 counterpart identified.
- [ ] `_AdminItemGroupCreateScreenState` (`lib/src/features/admin/presentation/admin_item_group_create_screen_widgets_part_01.dart:12`). partial — `src/admin/itemGroupsController.ts`.
- [ ] `_ItemGroupCreateDialogCardState` (`lib/src/features/admin/presentation/admin_item_group_create_screen_widgets_part_01.dart:223`). missing — no direct V4 counterpart identified.
- [ ] `_AdminNotificationsScreenState` (`lib/src/features/admin/presentation/admin_notifications_screen_widgets_part_01.dart:16`). missing — no direct V4 counterpart identified.
- [ ] `_AdminHydratedDetailHostState` (`lib/src/features/admin/presentation/admin_production_map_orders_admin_detail_host.dart:30`). partial — `src/workerDetailRecovery.ts`.
- [ ] `_AdminInitialDetailHostState` (`lib/src/features/admin/presentation/admin_production_map_orders_admin_detail_preview.dart:23`). missing — no direct V4 counterpart identified.
- [ ] `_AdminOrderPageViewportState` (`lib/src/features/admin/presentation/admin_production_map_orders_admin_paging.dart:810`). missing — no direct V4 counterpart identified.
- [ ] `_ClosedOrderTileState` (`lib/src/features/admin/presentation/admin_production_map_orders_closed_widgets.dart:74`). missing — no direct V4 counterpart identified.
- [ ] `_OrderMapProgressCardState` (`lib/src/features/admin/presentation/admin_production_map_orders_detail_map_widgets.dart:46`). missing — no direct V4 counterpart identified.
- [ ] `_OrderComboDetailCardState` (`lib/src/features/admin/presentation/admin_production_map_orders_detail_widgets.dart:703`). missing — no direct V4 counterpart identified.
- [ ] `_OrderHomashyoPickerSheetState` (`lib/src/features/admin/presentation/admin_production_map_orders_detail_widgets.dart:1056`). missing — no direct V4 counterpart identified.
- [ ] `_LaminationLayerRemainderSheetState` (`lib/src/features/admin/presentation/admin_production_map_orders_layer_remainders.dart:356`). missing — no direct V4 counterpart identified.
- [ ] `_RezkaOrderQuickSettingsState` (`lib/src/features/admin/presentation/admin_production_map_orders_module_pages.dart:1327`). missing — no direct V4 counterpart identified.
- [ ] `_MoveModulePageState` (`lib/src/features/admin/presentation/admin_production_map_orders_move_module.dart:55`). missing — no direct V4 counterpart identified.
- [ ] `_ApparatusTransferReasonDialogState` (`lib/src/features/admin/presentation/admin_production_map_orders_move_state.dart:40`). missing — no direct V4 counterpart identified.
- [ ] `_OpeningWipWizardState` (`lib/src/features/admin/presentation/admin_production_map_orders_opening_wip.dart:5`). missing — no direct V4 counterpart identified.
- [ ] `_AdminOpeningWipScreenState` (`lib/src/features/admin/presentation/admin_production_map_orders_opening_wip.dart:765`). missing — no direct V4 counterpart identified.
- [ ] `_OpeningWipListTabState` (`lib/src/features/admin/presentation/admin_production_map_orders_opening_wip.dart:917`). missing — no direct V4 counterpart identified.
- [ ] `_PreparationOrdersListState` (`lib/src/features/admin/presentation/admin_production_map_orders_preparation_list.dart:5`). partial — `src/preparation/PreparationSequence.android.tsx`, `src/preparation/PreparationSequence.ios.tsx`.
- [ ] `_ProgressQtyDialogState` (`lib/src/features/admin/presentation/admin_production_map_orders_progress_qty.dart:301`). missing — no direct V4 counterpart identified.
- [ ] `_QolipTasksPageState` (`lib/src/features/admin/presentation/admin_production_map_orders_qolip_tasks.dart:67`). missing — no direct V4 counterpart identified.
- [ ] `_ReadOnlyOrderDetailSheetState` (`lib/src/features/admin/presentation/admin_production_map_orders_read_only_sheet.dart:7`). missing — no direct V4 counterpart identified.
- [ ] `_ScannedWipHistorySheetState` (`lib/src/features/admin/presentation/admin_production_map_orders_scanned_wip.dart:80`). partial — `src/workerScannedWips.ts`.
- [ ] `_AdminProductionMapOrdersScreenState` (`lib/src/features/admin/presentation/admin_production_map_orders_screen_state.dart:3`). partial — `src/material/materialSequenceController.ts`.
- [ ] `_EarlyCloseOrderDialogState` (`lib/src/features/admin/presentation/admin_production_map_orders_screen_widgets.dart:47`). missing — no direct V4 counterpart identified.
- [ ] `_OrdersConnectionProgressState` (`lib/src/features/admin/presentation/admin_production_map_orders_screen_widgets.dart:320`). missing — no direct V4 counterpart identified.
- [ ] `_SequenceRawMaterialAssignmentSheetState` (`lib/src/features/admin/presentation/admin_production_map_orders_sequence_assignment_sheet.dart:3`). partial — `src/material/materialSequenceAssignmentController.ts`.
- [ ] `_SequenceQolipSheetState` (`lib/src/features/admin/presentation/admin_production_map_orders_sequence_qolip_sheet.dart:11`). missing — no direct V4 counterpart identified.
- [ ] `_SequenceModulePageState` (`lib/src/features/admin/presentation/admin_production_map_orders_sequence_widgets.dart:55`). missing — no direct V4 counterpart identified.
- [ ] `_SequenceOrderRowState` (`lib/src/features/admin/presentation/admin_production_map_orders_sequence_widgets.dart:648`). missing — no direct V4 counterpart identified.
- [ ] `_StageParticipantsSheetState` (`lib/src/features/admin/presentation/admin_production_map_orders_stage_participants.dart:21`). missing — no direct V4 counterpart identified.
- [ ] `_OrderCalculationDetailsState` (`lib/src/features/admin/presentation/admin_production_map_orders_summary_details.dart:17`). missing — no direct V4 counterpart identified.
- [ ] `_SupplyTasksScreenState` (`lib/src/features/admin/presentation/admin_production_map_orders_supply_tasks.dart:4`). partial — `src/material/MaterialTasks.ios.tsx`, `src/qolip/QolipTasksScreen.android.tsx`.
- [ ] `_WorkerWipHistorySheetState` (`lib/src/features/admin/presentation/admin_production_map_orders_wip_history_sheet.dart:136`). missing — no direct V4 counterpart identified.
- [ ] `_WorkerOrderOutputProgressState` (`lib/src/features/admin/presentation/admin_production_map_orders_worker_output_progress.dart:74`). missing — no direct V4 counterpart identified.
- [ ] `_ProductionMapCanvasState` (`lib/src/features/admin/presentation/admin_production_map_test_canvas.dart:3`). missing — no direct V4 counterpart identified.
- [ ] `_FormulaSheetFieldState` (`lib/src/features/admin/presentation/admin_production_map_test_formula_widgets.dart:154`). missing — no direct V4 counterpart identified.
- [ ] `_FormulaEditorSheetState` (`lib/src/features/admin/presentation/admin_production_map_test_formula_widgets.dart:234`). missing — no direct V4 counterpart identified.
- [ ] `_RezkaNodeEditSheetState` (`lib/src/features/admin/presentation/admin_production_map_test_node_edit_sheets.dart:23`). missing — no direct V4 counterpart identified.
- [ ] `_NodeEditSheetState` (`lib/src/features/admin/presentation/admin_production_map_test_node_edit_sheets.dart:220`). missing — no direct V4 counterpart identified.
- [ ] `_MapNodeVisualState` (`lib/src/features/admin/presentation/admin_production_map_test_node_visual.dart:46`). missing — no direct V4 counterpart identified.
- [ ] `_AdminProductionMapTestScreenState` (`lib/src/features/admin/presentation/admin_production_map_test_screen.dart:67`). missing — no direct V4 counterpart identified.
- [ ] `_PlainActionButtonState` (`lib/src/features/admin/presentation/admin_production_map_test_sheet_widgets.dart:18`). missing — no direct V4 counterpart identified.
- [ ] `_AdminProgressQrScanScreenState` (`lib/src/features/admin/presentation/admin_progress_qr_scan_screen.dart:35`). missing — no direct V4 counterpart identified.
- [ ] `_AdminPushConfigScreenState` (`lib/src/features/admin/presentation/admin_push_config_screen.dart:22`). missing — no direct V4 counterpart identified.
- [ ] `_AdminQueuePolicyPanelState` (`lib/src/features/admin/presentation/admin_queue_policy_screen_widgets_part_01.dart:54`). partial — `src/admin/adminQueuePolicyController.ts`.
- [ ] `_AdminRawMaterialAssignmentPanelState` (`lib/src/features/admin/presentation/admin_raw_material_assignment_screen.dart:42`). partial — `src/material/materialAssignmentsController.ts`.
- [ ] `_AdminRawMaterialSettingsScreenState` (`lib/src/features/admin/presentation/admin_raw_material_rules_screen.dart:31`). missing — no direct V4 counterpart identified.
- [ ] `_RawMaterialGroupPickerDialogState` (`lib/src/features/admin/presentation/admin_raw_material_rules_screen_declarations_part_01.dart:274`). missing — no direct V4 counterpart identified.
- [ ] `_AdminRoleEditorSheetState` (`lib/src/features/admin/presentation/admin_roles_screen_models_part_03.dart:4`). missing — no direct V4 counterpart identified.
- [ ] `_RoleAssignmentSheetBodyState` (`lib/src/features/admin/presentation/admin_roles_screen_models_part_03.dart:157`). missing — no direct V4 counterpart identified.
- [ ] `_AdminRolesScreenState` (`lib/src/features/admin/presentation/admin_roles_screen_widgets_part_01.dart:11`). partial — `src/admin/useAdminRoles.ts`.
- [ ] `_RolesTabState` (`lib/src/features/admin/presentation/admin_roles_screen_widgets_part_01.dart:261`). missing — no direct V4 counterpart identified.
- [ ] `_AdminServerMonitorScreenState` (`lib/src/features/admin/presentation/admin_server_monitor_screen.dart:31`). missing — no direct V4 counterpart identified.
- [ ] `_PingSparklinePanelState` (`lib/src/features/admin/presentation/admin_server_monitor_screen_declarations_part_02.dart:263`). missing — no direct V4 counterpart identified.
- [ ] `_AdminSettingsScreenState` (`lib/src/features/admin/presentation/admin_settings_screen.dart:20`). missing — no direct V4 counterpart identified.
- [ ] `_SupplierPhoneInlineFieldState` (`lib/src/features/admin/presentation/admin_supplier_detail_screen_models_part_03.dart:4`). partial — `src/admin/useAdminSupplierDetail.ts`.
- [ ] `_AdminSupplierDetailScreenState` (`lib/src/features/admin/presentation/admin_supplier_detail_screen_widgets_part_01.dart:21`). partial — `src/admin/adminSupplierDetailController.ts`.
- [ ] `_AdminSupplierItemsAddScreenState` (`lib/src/features/admin/presentation/admin_supplier_items_add_screen.dart:22`). missing — no direct V4 counterpart identified.
- [ ] `_AdminSupplierItemsViewScreenState` (`lib/src/features/admin/presentation/admin_supplier_items_view_screen.dart:22`). partial — `src/admin/adminSupplierItemsController.ts`.
- [ ] `_AdminSuppliersScreenState` (`lib/src/features/admin/presentation/admin_suppliers_screen.dart:45`). partial — `src/admin/adminUsersController.ts`.
- [ ] `_AdminTrainingScreenState` (`lib/src/features/admin/presentation/admin_training_screen.dart:43`). missing — no direct V4 counterpart identified.
- [ ] `_TrainingOrderCardState` (`lib/src/features/admin/presentation/admin_training_screen_models_part_03.dart:4`). missing — no direct V4 counterpart identified.
- [ ] `_TrainingOrderDetailsSheetState` (`lib/src/features/admin/presentation/admin_training_screen_models_part_04.dart:4`). missing — no direct V4 counterpart identified.
- [ ] `_TrainingMaterialLinkSheetState` (`lib/src/features/admin/presentation/admin_training_screen_models_part_05.dart:4`). missing — no direct V4 counterpart identified.
- [ ] `_WerkaCreateTabState` (`lib/src/features/admin/presentation/admin_user_create_screen_declarations_part_03.dart:223`). missing — no direct V4 counterpart identified.
- [ ] `_CustomerCreateTabState` (`lib/src/features/admin/presentation/admin_user_create_screen_models_part_02.dart:4`). missing — no direct V4 counterpart identified.
- [ ] `_SupplierCreateTabState` (`lib/src/features/admin/presentation/admin_user_create_screen_models_part_02.dart:120`). missing — no direct V4 counterpart identified.
- [ ] `_CustomRoleCreateTabState` (`lib/src/features/admin/presentation/admin_user_create_screen_models_part_02.dart:196`). missing — no direct V4 counterpart identified.
- [ ] `_AdminUserCreateScreenState` (`lib/src/features/admin/presentation/admin_user_create_screen_widgets_part_01.dart:19`). missing — no direct V4 counterpart identified.
- [ ] `_RawMaterialStockQrSheetState` (`lib/src/features/admin/presentation/admin_warehouses_screen_declarations_part_03.dart:123`). missing — no direct V4 counterpart identified.
- [ ] `_RawMaterialStockEditSheetState` (`lib/src/features/admin/presentation/admin_warehouses_screen_models_part_04.dart:4`). missing — no direct V4 counterpart identified.
- [ ] `_AdminWarehousesScreenState` (`lib/src/features/admin/presentation/admin_warehouses_screen_models_resplit_part_01.dart:4`). partial — `src/admin/useAdminWarehouseMain.ts`.
- [ ] `_WarehouseDetailsTabState` (`lib/src/features/admin/presentation/admin_warehouses_screen_models_resplit_part_02.dart:4`). missing — no direct V4 counterpart identified.
- [ ] `_WarehouseSettingsTabState` (`lib/src/features/admin/presentation/admin_warehouses_screen_models_resplit_part_03.dart:4`). partial — `src/admin/adminWarehouseSettingsController.ts`.
- [ ] `_WarehouseReservationOrderDetailsState` (`lib/src/features/admin/presentation/admin_warehouses_screen_reservation_details.dart:45`). missing — no direct V4 counterpart identified.
- [ ] `_WarehouseCreateCardState` (`lib/src/features/admin/presentation/admin_warehouses_screen_widgets_part_01.dart:157`). partial — `src/admin/adminWarehouseCreateController.ts`.
- [ ] `_AdminWerkaScreenState` (`lib/src/features/admin/presentation/admin_werka_screen_widgets_part_01.dart:13`). partial — `src/admin/adminWerkaController.ts`.
- [ ] `_WerkaPhoneInlineFieldState` (`lib/src/features/admin/presentation/admin_werka_screen_widgets_part_02.dart:157`). missing — no direct V4 counterpart identified.
- [ ] `_AdminWipBatchesScreenState` (`lib/src/features/admin/presentation/admin_wip_batches_screen_declarations_part_01.dart:13`). missing — no direct V4 counterpart identified.
- [ ] `_AdminWorkerDetailScreenState` (`lib/src/features/admin/presentation/admin_worker_detail_screen.dart:35`). partial — `src/admin/adminWorkerDetailController.ts`.
- [ ] `_WorkerPhoneInlineFieldState` (`lib/src/features/admin/presentation/admin_worker_detail_screen_widgets_part_02.dart:126`). missing — no direct V4 counterpart identified.
- [ ] `_AdminWorkerProfileDetailScreenState` (`lib/src/features/admin/presentation/admin_worker_profile_detail_screen.dart:35`). partial — `src/admin/adminWorkerProfileController.ts`.
- [ ] `_AdminWorkerSettingsScreenState` (`lib/src/features/admin/presentation/admin_worker_settings_screen.dart:57`). missing — no direct V4 counterpart identified.
- [ ] `_WorkerCreateDialogCardState` (`lib/src/features/admin/presentation/admin_worker_settings_screen_helpers_part_01.dart:168`). missing — no direct V4 counterpart identified.
- [ ] `_WorkerNameEditDialogCardState` (`lib/src/features/admin/presentation/admin_worker_settings_screen_helpers_part_01.dart:325`). missing — no direct V4 counterpart identified.
- [ ] `_WorkerGroupsTabState` (`lib/src/features/admin/presentation/admin_worker_settings_screen_models_part_03.dart:4`). missing — no direct V4 counterpart identified.
- [ ] `_WorkerGroupCreateDialogCardState` (`lib/src/features/admin/presentation/admin_worker_settings_screen_widgets_part_02.dart:20`). missing — no direct V4 counterpart identified.
- [ ] `_WorkerApparatusAssignmentSheetState` (`lib/src/features/admin/presentation/admin_worker_settings_screen_widgets_part_06.dart:323`). missing — no direct V4 counterpart identified.
- [ ] `_PendingOrderDetailSheetState` (`lib/src/features/admin/presentation/pending_order_widgets.dart:173`). missing — no direct V4 counterpart identified.
- [ ] `_RawMaterialScanDialogState` (`lib/src/features/admin/presentation/raw_material_scan_dialog_declarations_part_03.dart:112`). missing — no direct V4 counterpart identified.
- [ ] `_ProductionQuickScannerPanelState` (`lib/src/features/admin/presentation/raw_material_scan_dialog_models_part_02.dart:4`). partial — `src/material/useMaterialQuickScanner.ts`.
- [ ] `_ServerEndpointSwitcherSheetState` (`lib/src/features/admin/presentation/server_endpoint_switcher_sheet.dart:31`). missing — no direct V4 counterpart identified.
- [ ] `_AdminAparatchiApparatusCardState` (`lib/src/features/admin/presentation/widgets/admin_aparatchi_apparatus_card.dart:28`). missing — no direct V4 counterpart identified.
- [ ] `_AdminMaterialApparatusSheetState` (`lib/src/features/admin/presentation/widgets/admin_aparatchi_apparatus_card.dart:361`). missing — no direct V4 counterpart identified.
- [ ] `_AdminAppUpdateSettingsCardState` (`lib/src/features/admin/presentation/widgets/admin_app_update_settings_card.dart:16`). missing — no direct V4 counterpart identified.
- [ ] `_AdminFabOverlayActionMenuState` (`lib/src/features/admin/presentation/widgets/admin_create_hub_sheet_declarations_part_03.dart:43`). missing — no direct V4 counterpart identified.
- [ ] `_AdminCreateHubOverlayState` (`lib/src/features/admin/presentation/widgets/admin_create_hub_sheet_models_part_02.dart:4`). missing — no direct V4 counterpart identified.
- [ ] `_AdminFabActionOverlayState` (`lib/src/features/admin/presentation/widgets/admin_create_hub_sheet_models_part_04.dart:4`). missing — no direct V4 counterpart identified.
- [ ] `_AdminFabActionMenuState` (`lib/src/features/admin/presentation/widgets/admin_create_hub_sheet_models_part_05.dart:4`). missing — no direct V4 counterpart identified.
- [ ] `_AdminItemGroupItemsTabState` (`lib/src/features/admin/presentation/widgets/admin_item_group_items_tab.dart:31`). missing — no direct V4 counterpart identified.
- [ ] `_AdminItemGroupParentMovePanelState` (`lib/src/features/admin/presentation/widgets/admin_item_group_parent_move_panel.dart:30`). missing — no direct V4 counterpart identified.
- [ ] `_AdminItemGroupTreePanelState` (`lib/src/features/admin/presentation/widgets/admin_item_group_tree_panel.dart:20`). missing — no direct V4 counterpart identified.
- [ ] `_AdminLaminationSettingsCardState` (`lib/src/features/admin/presentation/widgets/admin_lamination_settings_card.dart:16`). missing — no direct V4 counterpart identified.
- [ ] `_AdminModuleCardState` (`lib/src/features/admin/presentation/widgets/admin_module_card.dart:20`). missing — no direct V4 counterpart identified.
- [ ] `_AdminOrderImageThumbState` (`lib/src/features/admin/presentation/widgets/admin_order_image_thumb.dart:34`). missing — no direct V4 counterpart identified.
- [ ] `_AdminOrderCoverThumbState` (`lib/src/features/admin/presentation/widgets/admin_order_image_thumb.dart:116`). missing — no direct V4 counterpart identified.
- [ ] `_AdminPartyCreateScaffoldState` (`lib/src/features/admin/presentation/widgets/admin_party_create_scaffold.dart:34`). missing — no direct V4 counterpart identified.
- [ ] `_AdminPreparationResponsibilityEditorState` (`lib/src/features/admin/presentation/widgets/admin_preparation_responsibility_editor.dart:36`). missing — no direct V4 counterpart identified.
- [ ] `_AdminQolipStartSettingsCardState` (`lib/src/features/admin/presentation/widgets/admin_qolip_start_settings_card.dart:16`). missing — no direct V4 counterpart identified.
- [ ] `_AdminSequenceApparatusFilterState` (`lib/src/features/admin/presentation/widgets/admin_sequence_apparatus_filter.dart:37`). missing — no direct V4 counterpart identified.
- [ ] `_AdminNoticeTextState` (`lib/src/features/admin/presentation/widgets/admin_top_notice.dart:62`). missing — no direct V4 counterpart identified.
- [ ] `_AdminWarehouseAssignmentEditorState` (`lib/src/features/admin/presentation/widgets/admin_warehouse_assignment_editor.dart:61`). missing — no direct V4 counterpart identified.
- [ ] `_AdminWarehousePickerSheetState` (`lib/src/features/admin/presentation/widgets/admin_warehouse_picker_sheet.dart:28`). missing — no direct V4 counterpart identified.
- [ ] `_WorkerQueueLimitFilterState` (`lib/src/features/admin/presentation/widgets/worker_queue_limit_filter.dart:21`). partial — `src/workerQueuePresentation.ts`.
- [ ] `_AdminTelegramScreenState` (`lib/src/features/admin/telegram/presentation/admin_telegram_screen_widgets_part_01.dart:11`). missing — no direct V4 counterpart identified.
- [ ] `_TelegramAlertSettingsCardState` (`lib/src/features/admin/telegram/presentation/telegram_alert_settings_card.dart:22`). missing — no direct V4 counterpart identified.
- [ ] `_TelegramBotSettingsSheetState` (`lib/src/features/admin/telegram/presentation/telegram_bot_settings_sheet.dart:28`). missing — no direct V4 counterpart identified.
- [ ] `_TelegramInviteQrSheetState` (`lib/src/features/admin/telegram/presentation/telegram_invite_qr_sheet.dart:29`). missing — no direct V4 counterpart identified.
- [ ] `_TelegramUserbotSettingsSheetState` (`lib/src/features/admin/telegram/presentation/telegram_userbot_settings_sheet.dart:29`). missing — no direct V4 counterpart identified.

## HTTPS method and endpoint checklist

- [ ] `activeRezkaPaddon` `/v1/mobile/admin/production-maps/paddons/active` (`lib/src/core/api/admin/mobile_api_paddons.dart:309`). partial — `src/paddonsApi.ts`.
- [ ] `adminActivity` `/v1/mobile/admin/activity` (`lib/src/core/api/admin/mobile_api_admin_settings_monitor_declarations_part_02.dart:42`). partial — `src/admin/adminActivityApi.ts`.
- [ ] `adminApparatusCapacitySnapshot` `/v1/mobile/admin/production-maps/capacity` (`lib/src/core/api/admin/mobile_api_admin_capacity_schedule_declarations_part_02.dart:5`). partial — `src/admin/apparatusCapacityApi.ts`.
- [ ] `adminApparatusCollections` `/v1/mobile/admin/apparatus-collections` (`lib/src/core/api/admin/mobile_api_admin_items_MobileApiAdminItems_methods_01.dart:431`). partial — `src/admin/apparatusCollection.ts`.
- [ ] `adminApparatusMasterOptions` `/v1/mobile/admin/apparatus/options` (`lib/src/core/api/admin/mobile_api_admin_items_MobileApiAdminItems_methods_02.dart:173`). partial — `src/admin/apparatusOptionsApi.ts`.
- [ ] `adminApparatusQueueActionResult` `/v1/mobile/admin/production-maps/queue-action` (`lib/src/core/api/admin/mobile_api_admin_queue_action_result.dart:4`). partial — `src/workerQueueAction.ts`.
- [ ] `adminApparatusQueuePolicies` `/v1/mobile/admin/production-maps/queue-policies` (`lib/src/core/api/admin/mobile_api_admin_queue_state_models_part_02.dart:240`). partial — `src/admin/adminQueuePolicyApi.ts`.
- [ ] `adminAssignCustomerItem` `/v1/mobile/admin/customers/items/add` (`lib/src/core/api/admin/mobile_api_admin_items_MobileApiAdminItems_methods_01.dart:96`). partial — `src/admin/adminCustomerDetailApi.ts`.
- [ ] `adminAssignedSupplierItems` `/v1/mobile/admin/suppliers/items/assigned` (`lib/src/core/api/admin/mobile_api_admin_suppliers_customers_MobileApiAdminSuppliersCustomers_methods_02.dart:151`). partial — `src/admin/adminSupplierItemsApi.ts`.
- [ ] `adminAssignRawMaterialToOrder` `/v1/mobile/admin/raw-material-assignments` (`lib/src/core/api/admin/mobile_api_admin_raw_materials_MobileApiAdminRawMaterials_methods_02.dart:368`). partial — `src/preparation/preparationInventoryAssignment.ts`.
- [ ] `adminAssignSupplierItem` `/v1/mobile/admin/suppliers/items/add` (`lib/src/core/api/admin/mobile_api_admin_suppliers_customers_MobileApiAdminSuppliersCustomers_methods_02.dart:169`). partial — `src/admin/adminSupplierItemsApi.ts`.
- [ ] `adminAssignWarehouse` `/v1/mobile/admin/warehouses/assignments` (`lib/src/core/api/admin/mobile_api_admin_items_MobileApiAdminItems_methods_03.dart:256`). partial — `src/admin/adminWarehouseAssignmentApi.ts`.
- [ ] `adminAutoOpenProductionMap` `/v1/mobile/admin/production-maps/auto-open` (`lib/src/core/api/admin/mobile_api_admin_production_map_MobileApiAdminProductionMap_methods_01.dart:412`). partial — `src/admin/productionMapDraftApi.ts`.
- [ ] `adminBosmaAstatkaReport` `/v1/mobile/admin/production-maps/bosma-astatka` (`lib/src/core/api/admin/mobile_api_admin_bosma_astatka.dart:11`). partial — `src/workerControlsApi.ts`.
- [ ] `adminCancelApparatusScheduleReservation` `/v1/mobile/admin/production-maps/schedule/cancel` (`lib/src/core/api/admin/mobile_api_admin_capacity_schedule_declarations_part_02.dart:226`). missing — no direct V4 counterpart identified.
- [ ] `adminCancelStartedWork` `/v1/mobile/admin/production-maps/cancel-start` (`lib/src/core/api/admin/mobile_api_cancel_start.dart:42`). partial — `src/workerControlsApi.ts`.
- [ ] `adminCanonicalApparatus`  (`lib/src/core/api/admin/mobile_api_admin_items_MobileApiAdminItems_methods_04.dart:260`). partial — `src/admin/canonicalApparatusMutationApi.ts`.
- [ ] `adminCapabilities` `/v1/mobile/admin/capabilities` (`lib/src/core/api/admin/mobile_api_admin_production_map_MobileApiAdminProductionMap_methods_01.dart:41`). partial — `src/admin/adminRolesApi.ts`.
- [ ] `adminClosedProductionMapOrders` `/v1/mobile/admin/production-maps/closed-orders` (`lib/src/core/api/admin/mobile_api_admin_order_lifecycle_MobileApiAdminOrderLifecycle_methods_01.dart:311`). partial — `src/workerClosedOrders.ts`.
- [ ] `adminClosedProductionOrderDetail` `/v1/mobile/admin/production-maps/closed-order` (`lib/src/core/api/admin/mobile_api_admin_order_page.dart:765`). partial — `src/workerClosedOrders.ts`.
- [ ] `adminCompletedProductionMapOrders` `/v1/mobile/admin/production-maps/completed-orders` (`lib/src/core/api/admin/mobile_api_admin_order_lifecycle_MobileApiAdminOrderLifecycle_methods_01.dart:133`). missing — no direct V4 counterpart identified.
- [ ] `adminConfirmRawMaterialStockReprint` `/v1/mobile/admin/raw-material-stock/reprint/confirm` (`lib/src/core/api/admin/mobile_api_admin_items_MobileApiAdminItems_methods_03.dart:78`). partial — `src/shared/printApi.ts`.
- [ ] `adminCreateApparatus` `/v1/mobile/admin/apparatus` (`lib/src/core/api/admin/mobile_api_admin_items_MobileApiAdminItems_methods_04.dart:5`). partial — `src/admin/canonicalApparatusMutationApi.ts`.
- [ ] `adminCreateApparatusCollection` `/v1/mobile/admin/apparatus-collections` (`lib/src/core/api/admin/mobile_api_admin_items_MobileApiAdminItems_methods_02.dart:5`). partial — `src/admin/apparatusCollection.ts`.
- [ ] `adminCreateCustomer` `/v1/mobile/admin/customers` (`lib/src/core/api/admin/mobile_api_admin_suppliers_customers_MobileApiAdminSuppliersCustomers_methods_01.dart:392`). partial — `src/admin/adminUserCreateApi.ts`.
- [ ] `adminCreateFactoryLocation` `/v1/mobile/admin/factory-locations` (`lib/src/core/api/admin/mobile_api_factory_locations.dart:43`). partial — `src/admin/factoryLocationApi.ts`.
- [ ] `adminCreateItem` `/v1/mobile/admin/items` (`lib/src/core/api/admin/mobile_api_admin_items_MobileApiAdminItems_methods_04.dart:337`). partial — `src/admin/adminItemCatalogApi.ts`.
- [ ] `adminCreateItemGroup` `/v1/mobile/admin/item-groups` (`lib/src/core/api/admin/mobile_api_admin_item_groups.dart:43`). partial — `src/admin/itemGroupApi.ts`.
- [ ] `adminCreateMaterialTaminotchi` `/v1/mobile/admin/material-taminotchilar` (`lib/src/core/api/admin/mobile_api_admin_suppliers_customers_MobileApiAdminSuppliersCustomers_methods_02.dart:5`). partial — `src/admin/adminUserCreateApi.ts`.
- [ ] `adminCreateOpeningWip` `/v1/mobile/admin/production-maps/opening-wip` (`lib/src/core/api/admin/mobile_api_admin_opening_wip_declarations_part_02.dart:5`). partial — `src/admin/openingWipApi.ts`.
- [ ] `adminCreateSupplier` `/v1/mobile/admin/suppliers` (`lib/src/core/api/admin/mobile_api_admin_suppliers_customers_MobileApiAdminSuppliersCustomers_methods_01.dart:372`). partial — `src/admin/adminUserCreateApi.ts`.
- [ ] `adminCreateSystemUser` `/v1/mobile/admin/system-users` (`lib/src/core/api/admin/mobile_api_admin_users_workers_MobileApiAdminUsersWorkers_methods_01.dart:129`). partial — `src/admin/adminUserCreateApi.ts`, `src/admin/adminWorkerDetailApi.ts`.
- [ ] `adminCreateWarehouse` `/v1/mobile/admin/warehouses` (`lib/src/core/api/admin/mobile_api_admin_items_MobileApiAdminItems_methods_03.dart:103`). partial — `src/admin/warehouseApi.ts`.
- [ ] `adminCreateWorker` `/v1/mobile/admin/workers` (`lib/src/core/api/admin/mobile_api_admin_users_workers_MobileApiAdminUsersWorkers_methods_01.dart:99`). partial — `src/admin/adminWorkerDetailApi.ts`, `src/admin/workerSettingsApi.ts`.
- [ ] `adminCustomerDetail` `/v1/mobile/admin/customers/detail` (`lib/src/core/api/admin/mobile_api_admin_suppliers_customers_MobileApiAdminSuppliersCustomers_methods_01.dart:113`). partial — `src/admin/adminCustomerDetailApi.ts`.
- [ ] `adminCustomers` `/v1/mobile/admin/customers/list` (`lib/src/core/api/admin/mobile_api_admin_suppliers_customers_MobileApiAdminSuppliersCustomers_methods_02.dart:35`). partial — `src/admin/adminItemCreateCustomersApi.ts`, `src/admin/adminItemDetailApi.ts`.
- [ ] `adminCustomersForItem`  (`lib/src/core/api/admin/mobile_api_admin_items_MobileApiAdminItems_methods_01.dart:38`). missing — no direct V4 counterpart identified.
- [ ] `adminDeactivateWorker` `/v1/mobile/admin/workers` (`lib/src/core/api/admin/mobile_api_admin_users_workers_MobileApiAdminUsersWorkers_methods_02.dart:99`). partial — `src/admin/adminWorkerDetailApi.ts`, `src/admin/workerSettingsApi.ts`.
- [ ] `adminDeleteApparatusCollection`  (`lib/src/core/api/admin/mobile_api_admin_items_MobileApiAdminItems_methods_02.dart:131`). partial — `src/admin/apparatusCollection.ts`.
- [ ] `adminDeleteItem` `/v1/mobile/admin/items/detail` (`lib/src/core/api/admin/mobile_api_admin_items_MobileApiAdminItems_methods_05.dart:147`). partial — `src/admin/adminItemDetailApi.ts`.
- [ ] `adminDeleteOpeningWipBatch` `/v1/mobile/admin/production-maps/opening-wip` (`lib/src/core/api/admin/mobile_api_admin_opening_wip_declarations_part_02.dart:140`). partial — `src/admin/openingWipDeleteApi.ts`.
- [ ] `adminDeleteRawMaterialStock` `/v1/mobile/admin/raw-material-stock` (`lib/src/core/api/admin/mobile_api_admin_items_MobileApiAdminItems_methods_02.dart:349`). partial — `src/admin/rawMaterialStockApi.ts`.
- [ ] `adminDeleteTrainingInputBatch` `/v1/mobile/admin/training/input-batches` (`lib/src/core/api/admin/mobile_api_admin_training_MobileApiAdminTrainingWorkspace_methods_02.dart:192`). missing — no direct V4 counterpart identified.
- [ ] `adminDeleteTrainingProductionMap` `/v1/mobile/admin/training/production-maps` (`lib/src/core/api/admin/mobile_api_admin_training_MobileApiAdminTrainingWorkspace_methods_02.dart:291`). missing — no direct V4 counterpart identified.
- [ ] `adminDeleteTrainingRawMaterial` `/v1/mobile/admin/training/raw-material-assignments` (`lib/src/core/api/admin/mobile_api_admin_training_MobileApiAdminTrainingWorkspace_methods_03.dart:5`). missing — no direct V4 counterpart identified.
- [ ] `adminDeleteWarehouse` `/v1/mobile/admin/warehouses` (`lib/src/core/api/admin/mobile_api_admin_items_MobileApiAdminItems_methods_03.dart:147`). partial — `src/admin/warehouseApi.ts`.
- [ ] `adminDownloadBackup` `/v1/mobile/admin/system/backups/{}/download` (`lib/src/core/api/admin/mobile_api_admin_settings_monitor_declarations_part_02.dart:318`). missing — no direct V4 counterpart identified.
- [ ] `adminEarlyCloseProductionOrder` `/v1/mobile/admin/production-maps/order-control` (`lib/src/core/api/admin/mobile_api_admin_queue_state_models_part_02.dart:208`). partial — `src/workerEarlyCloseApi.ts`.
- [ ] `adminFactoryLocations` `/v1/mobile/admin/factory-locations` (`lib/src/core/api/admin/mobile_api_factory_locations.dart:10`). partial — `src/admin/factoryLocationApi.ts`.
- [ ] `adminGenerateTrainingInputBatch`  (`lib/src/core/api/admin/mobile_api_admin_training_MobileApiAdminTrainingWorkspace_methods_02.dart:181`). missing — no direct V4 counterpart identified.
- [ ] `adminGenerateTrainingInputBatches` `/v1/mobile/admin/training/input-batches` (`lib/src/core/api/admin/mobile_api_admin_training_MobileApiAdminTrainingWorkspace_methods_02.dart:69`). missing — no direct V4 counterpart identified.
- [ ] `adminImportBackup` `/v1/mobile/admin/system/backups/import` (`lib/src/core/api/admin/mobile_api_admin_settings_monitor_declarations_part_02.dart:207`). missing — no direct V4 counterpart identified.
- [ ] `adminInactiveSuppliers` `/v1/mobile/admin/suppliers/inactive` (`lib/src/core/api/admin/mobile_api_admin_suppliers_customers_MobileApiAdminSuppliersCustomers_methods_01.dart:74`). partial — `src/admin/adminInactiveSuppliersApi.ts`.
- [ ] `adminItemDetail` `/v1/mobile/admin/items/detail` (`lib/src/core/api/admin/mobile_api_admin_items_MobileApiAdminItems_methods_04.dart:366`). partial — `src/admin/adminItemDetailApi.ts`.
- [ ] `adminItemGroups` `/v1/mobile/admin/item-groups` (`lib/src/core/api/admin/mobile_api_admin_item_groups.dart:4`). partial — `src/admin/itemGroupApi.ts`.
- [ ] `adminItemGroupTree` `/v1/mobile/admin/item-groups/tree` (`lib/src/core/api/admin/mobile_api_admin_item_groups.dart:21`). partial — `src/admin/itemGroupApi.ts`.
- [ ] `adminItems`  (`lib/src/core/api/admin/mobile_api_admin_items_MobileApiAdminItems_methods_01.dart:146`). partial — `src/admin/adminCustomerDetailApi.ts`, `src/admin/itemGroupApi.ts`.
- [ ] `adminItemsPage` `/v1/mobile/admin/items` (`lib/src/core/api/admin/mobile_api_admin_items_MobileApiAdminItems_methods_01.dart:170`). partial — `src/gscale/gscaleAdminApi.ts`.
- [ ] `adminItemUoms` `/v1/mobile/admin/items/uoms` (`lib/src/core/api/admin/mobile_api_admin_items_MobileApiAdminItems_methods_01.dart:5`). partial — `src/admin/itemGroupApi.ts`.
- [ ] `adminLaminationAstatkaSnapshot` `/v1/mobile/admin/production-maps/laminatsiya-astatka` (`lib/src/core/api/admin/mobile_api_admin_layer_remainders.dart:396`). partial — `src/workerLaminationApi.ts`.
- [ ] `adminLaminatsiyaAstatkaReport` `/v1/mobile/admin/production-maps/laminatsiya-astatka` (`lib/src/core/api/admin/mobile_api_admin_order_lifecycle_MobileApiAdminOrderLifecycle_methods_01.dart:337`). partial — `src/workerLaminationReportApi.ts`.
- [ ] `adminLayerRemainderReprint` `/v1/mobile/admin/production-maps/layer-remainders{}` (`lib/src/core/api/admin/mobile_api_admin_layer_remainders.dart:503`). partial — `src/workerLayerRemainderReprintApi.ts`.
- [ ] `adminLayerRemainders` `/v1/mobile/admin/production-maps/layer-remainders` (`lib/src/core/api/admin/mobile_api_admin_layer_remainders.dart:449`). partial — `src/workerLaminationApi.ts`.
- [ ] `adminLinkTrainingRawMaterial` `/v1/mobile/admin/training/raw-material-assignments` (`lib/src/core/api/admin/mobile_api_admin_training_declarations_part_02.dart:12`). missing — no direct V4 counterpart identified.
- [ ] `adminLookupOpeningWip` `/v1/mobile/admin/production-maps/opening-wip/lookup` (`lib/src/core/api/admin/mobile_api_admin_opening_wip_declarations_part_02.dart:167`). partial — `src/workerOpeningWip.ts`.
- [ ] `adminMaterialStartDeliveryCandidates` `/v1/mobile/admin/raw-material-start-receipt` (`lib/src/core/api/admin/mobile_api_material_start_receipt.dart:26`). partial — `src/workerMaterialDelivery.ts`.
- [ ] `adminMaterialTaminotchiDetail` `/v1/mobile/admin/material-taminotchilar/detail` (`lib/src/core/api/admin/mobile_api_admin_suppliers_customers_MobileApiAdminSuppliersCustomers_methods_01.dart:133`). partial — `src/admin/adminCustomerDetailApi.ts`.
- [ ] `adminMoveItemGroupParent` `/v1/mobile/admin/item-groups` (`lib/src/core/api/admin/mobile_api_admin_item_groups.dart:64`). partial — `src/admin/itemGroupApi.ts`.
- [ ] `adminMoveItemsToGroup` `/v1/mobile/admin/items/bulk-move-group` (`lib/src/core/api/admin/mobile_api_admin_items_MobileApiAdminItems_methods_04.dart:313`). partial — `src/admin/itemGroupApi.ts`.
- [ ] `adminMoveProductionMapOrdersBatch` `/v1/mobile/admin/production-maps/move-batch` (`lib/src/core/api/admin/mobile_api_admin_production_map_MobileApiAdminProductionMap_methods_01.dart:502`). partial — `src/workerProductionMapMoveApi.ts`.
- [ ] `adminMoveProductionMapSequence` `/v1/mobile/admin/production-maps/sequence` (`lib/src/core/api/admin/mobile_api_admin_sequence_move.dart:21`). partial — `src/workerSequenceMoveApi.ts`.
- [ ] `adminOpenedOrderEditSource` `/v1/mobile/admin/production-maps/order-edit` (`lib/src/core/api/admin/mobile_api_opened_order_edit.dart:68`). partial — `src/workerOpenedOrderEditApi.ts`.
- [ ] `adminOpeningWipCandidates` `/v1/mobile/admin/production-maps/opening-wip/lookup` (`lib/src/core/api/admin/mobile_api_admin_opening_wip_declarations_part_02.dart:212`). partial — `src/workerOpeningWipCandidatesApi.ts`.
- [ ] `adminOpeningWipQrReport` `/v1/mobile/admin/production-maps/opening-wip/qr/report` (`lib/src/core/api/admin/mobile_api_admin_opening_wip_declarations_part_02.dart:79`). partial — `src/admin/adminProgressQrFallbackApi.ts`.
- [ ] `adminOpeningWipRecords` `/v1/mobile/admin/production-maps/opening-wip` (`lib/src/core/api/admin/mobile_api_admin_opening_wip_declarations_part_02.dart:37`). partial — `src/workerOpeningWipRecordsApi.ts`.
- [ ] `adminOrderScanBootstrap` `/v1/mobile/admin/production-maps/order-scan-bootstrap` (`lib/src/core/api/admin/mobile_api_admin_order_scan_bootstrap.dart:350`). partial — `src/workerScanBootstrap.ts`.
- [ ] `adminPaddonQrReport` `/v1/mobile/admin/production-maps/paddons/qr/report` (`lib/src/core/api/admin/mobile_api_paddons.dart:397`). partial — `src/admin/adminProgressQrFallbackApi.ts`, `src/paddonManagementApi.ts`.
- [ ] `adminPatchCanonicalApparatus`  (`lib/src/core/api/admin/mobile_api_admin_items_MobileApiAdminItems_methods_04.dart:274`). partial — `src/admin/canonicalApparatusMutationApi.ts`.
- [ ] `adminPrepareRawMaterialStockReprint` `/v1/mobile/admin/raw-material-stock/reprint/prepare` (`lib/src/core/api/admin/mobile_api_admin_items_MobileApiAdminItems_methods_03.dart:5`). partial — `src/shared/printApi.ts`.
- [ ] `adminPrintOpeningWip` `/v1/mobile/admin/production-maps/opening-wip/print` (`lib/src/core/api/admin/mobile_api_admin_opening_wip_declarations_part_02.dart:255`). partial — `src/workerOpeningWipPrintApi.ts`.
- [ ] `adminPrintPreflight` `/v1/mobile/admin/production-maps/print-preflight` (`lib/src/core/api/admin/mobile_api_admin_print_preflight.dart:91`). partial — `src/workerPrintPreflight.ts`.
- [ ] `adminProductionCombo` `/v1/mobile/admin/combos` (`lib/src/core/api/admin/mobile_api_admin_combos.dart:126`). partial — `src/admin/adminItemDetailComboApi.ts`, `src/productionComboApi.ts`.
- [ ] `adminProductionMap` `/v1/mobile/admin/production-maps` (`lib/src/core/api/admin/mobile_api_admin_production_map_MobileApiAdminProductionMap_methods_01.dart:115`). partial — `src/productionMapReadApi.ts`.
- [ ] `adminProductionMapAudit` `/v1/mobile/admin/production-maps/audit` (`lib/src/core/api/admin/mobile_api_admin_production_map_MobileApiAdminProductionMap_methods_01.dart:84`). partial — `src/productionMapAuditApi.ts`.
- [ ] `adminProductionMapCompletionRequestDecision` `/v1/mobile/admin/production-maps/completion-requests/decision` (`lib/src/core/api/admin/mobile_api_admin_order_lifecycle_MobileApiAdminOrderLifecycle_methods_01.dart:202`). partial — `src/productionCompletionApi.ts`.
- [ ] `adminProductionMapCompletionRequestDecisions` `/v1/mobile/admin/production-maps/completion-request-decisions` (`lib/src/core/api/admin/mobile_api_admin_order_lifecycle_MobileApiAdminOrderLifecycle_methods_01.dart:276`). partial — `src/productionCompletionApi.ts`.
- [ ] `adminProductionMapCompletionRequests` `/v1/mobile/admin/production-maps/completion-requests` (`lib/src/core/api/admin/mobile_api_admin_order_lifecycle_MobileApiAdminOrderLifecycle_methods_01.dart:173`). partial — `src/productionCompletionApi.ts`.
- [ ] `adminProductionMapNotificationEvents`  (`lib/src/core/api/admin/mobile_api_admin_production_map_MobileApiAdminProductionMap_methods_02.dart:479`). partial — `src/productionMapNotifications.ts`.
- [ ] `adminProductionMapOrderControl` `/v1/mobile/admin/production-maps/order-control` (`lib/src/core/api/admin/mobile_api_admin_queue_state_models_part_02.dart:129`). partial — `src/productionOrderControlApi.ts`.
- [ ] `adminProductionMapOrderImage`  (`lib/src/core/api/admin/mobile_api_admin_production_map_MobileApiAdminProductionMap_methods_02.dart:699`). partial — `src/orderImageApi.ts`.
- [ ] `adminProductionMapOrderImageUrl` `/v1/mobile/admin/production-maps/order-image/view` (`lib/src/core/api/admin/mobile_api_order_images.dart:15`). partial — `src/orderImageUri.ts`.
- [ ] `adminProductionMapOrderSummary` `/v1/mobile/admin/production-maps/order-summary` (`lib/src/core/api/admin/mobile_api_admin_order_summary.dart:4`). missing — no direct V4 counterpart identified.
- [ ] `adminProductionMapQolipRequirements`  (`lib/src/core/api/admin/mobile_api_admin_qolip_orders.dart:203`). partial — `src/workerQolips.ts`.
- [ ] `adminProductionMapReplay` `/v1/mobile/admin/production-maps/replay` (`lib/src/core/api/admin/mobile_api_admin_production_map_MobileApiAdminProductionMap_methods_02.dart:641`). partial — `src/material/materialSequenceReplay.ts`, `src/productionMapReplayApi.ts`.
- [ ] `adminProductionMaps` `/v1/mobile/admin/production-maps` (`lib/src/core/api/admin/mobile_api_admin_production_map_MobileApiAdminProductionMap_methods_01.dart:57`). partial — `src/productionMapReadApi.ts`.
- [ ] `adminProductionOrderDetail` `/v1/mobile/admin/production-maps/sequence` (`lib/src/core/api/admin/mobile_api_admin_order_page.dart:710`). partial — `src/productionOrderDetailApi.ts`.
- [ ] `adminProductionOrderPage` `/v1/mobile/admin/production-maps/order-page` (`lib/src/core/api/admin/mobile_api_admin_order_page.dart:678`). partial — `src/productionOrderPageApi.ts`.
- [ ] `adminProgressQrHistory` `/v1/mobile/admin/production-maps/progress-qr/history` (`lib/src/core/api/admin/mobile_api_admin_progress_qr_declarations_part_04.dart:182`). partial — `src/workerProgressApi.ts`.
- [ ] `adminProgressQrLookup` `/v1/mobile/admin/production-maps/progress-qr/lookup` (`lib/src/core/api/admin/mobile_api_admin_progress_qr_declarations_part_04.dart:25`). partial — `src/workerProgressApi.ts`.
- [ ] `adminProgressQrReport` `/v1/mobile/admin/production-maps/progress-qr/report` (`lib/src/core/api/admin/mobile_api_admin_progress_qr_declarations_part_04.dart:511`). partial — `src/admin/adminProgressQrReportApi.ts`.
- [ ] `adminProgressQrReprint` `/v1/mobile/admin/production-maps/progress-qr/reprint` (`lib/src/core/api/admin/mobile_api_admin_progress_qr_declarations_part_04.dart:393`). partial — `src/productionProgressReprintApi.ts`.
- [ ] `adminPushConfig` `/v1/mobile/{}push-config{}` (`lib/src/core/api/admin/mobile_api_push_config.dart:41`). partial — `src/admin/adminPushConfigApi.ts`.
- [ ] `adminRawMaterialAssignmentCandidates` `/v1/mobile/admin/raw-material-assignments/candidates` (`lib/src/core/api/admin/mobile_api_admin_raw_materials_MobileApiAdminRawMaterials_methods_02.dart:5`). partial — `src/shared/rawMaterialAssignmentApi.ts`.
- [ ] `adminRawMaterialAssignmentDiagnostics` `/v1/mobile/admin/raw-material-assignments/diagnostics` (`lib/src/core/api/admin/mobile_api_admin_raw_materials_MobileApiAdminRawMaterials_methods_02.dart:178`). partial — `src/shared/rawMaterialAssignmentApi.ts`.
- [ ] `adminRawMaterialAssignmentOrders` `/v1/mobile/admin/raw-material-assignments/orders` (`lib/src/core/api/admin/mobile_api_admin_raw_materials_MobileApiAdminRawMaterials_methods_01.dart:326`). partial — `src/gscale/gscaleAdminApi.ts`.
- [ ] `adminRawMaterialAssignments` `/v1/mobile/admin/raw-material-assignments` (`lib/src/core/api/admin/mobile_api_admin_raw_materials_MobileApiAdminRawMaterials_methods_01.dart:281`). partial — `src/workerRawMaterials.ts`.
- [ ] `adminRawMaterialIntakeCandidates` `/v1/mobile/admin/raw-material-intake-candidates` (`lib/src/core/api/admin/mobile_api_admin_raw_materials_MobileApiAdminRawMaterials_methods_02.dart:239`). partial — `src/workerRawMaterials.ts`.
- [ ] `adminRawMaterialLookup` `/v1/mobile/admin/raw-material-assignments/lookup` (`lib/src/core/api/admin/mobile_api_admin_raw_materials_MobileApiAdminRawMaterials_methods_03.dart:166`). partial — `src/admin/adminProgressQrMaterialApi.ts`, `src/rawMaterialLookupApi.ts`.
- [ ] `adminRawMaterialRules` `/v1/mobile/admin/raw-material-rules` (`lib/src/core/api/admin/mobile_api_admin_raw_materials_MobileApiAdminRawMaterials_methods_01.dart:5`). partial — `src/admin/rawMaterialRulesApi.ts`.
- [ ] `adminRawMaterialStartRequirements` `/v1/mobile/admin/raw-material-start-requirements` (`lib/src/core/api/admin/mobile_api_admin_raw_materials_MobileApiAdminRawMaterials_methods_01.dart:129`). partial — `src/workerRawMaterials.ts`.
- [ ] `adminRawMaterialStock` `/v1/mobile/admin/raw-material-stock` (`lib/src/core/api/admin/mobile_api_admin_items_MobileApiAdminItems_methods_02.dart:225`). partial — `src/admin/rawMaterialStockApi.ts`.
- [ ] `adminReactivateCompletedWork` `/v1/mobile/admin/production-maps` (`lib/src/core/api/admin/mobile_api_reactivation.dart:138`). partial — `src/workerControlsApi.ts`.
- [ ] `adminReceiveMaterialForStart` `/v1/mobile/admin/raw-material-start-receipt` (`lib/src/core/api/admin/mobile_api_material_start_receipt.dart:100`). partial — `src/workerMaterialDelivery.ts`.
- [ ] `adminReceiveRawMaterialForActiveOrder` `/v1/mobile/admin/raw-material-intake` (`lib/src/core/api/admin/mobile_api_admin_raw_materials_MobileApiAdminRawMaterials_methods_03.dart:5`). partial — `src/workerRawMaterials.ts`.
- [ ] `adminRecloseReactivatedWork` `/v1/mobile/admin/production-maps/reactivation/reclose` (`lib/src/core/api/admin/mobile_api_reactivation_reclose.dart:49`). partial — `src/workerControlsApi.ts`.
- [ ] `adminRegenerateCustomerCode` `/v1/mobile/admin/customers/code/regenerate` (`lib/src/core/api/admin/mobile_api_admin_suppliers_customers_MobileApiAdminSuppliersCustomers_methods_01.dart:341`). partial — `src/admin/adminCustomerDetailApi.ts`.
- [ ] `adminRegenerateSupplierCode` `/v1/mobile/admin/suppliers/code/regenerate` (`lib/src/core/api/admin/mobile_api_admin_suppliers_customers_MobileApiAdminSuppliersCustomers_methods_02.dart:112`). partial — `src/admin/adminSupplierDetailApi.ts`.
- [ ] `adminRegenerateSystemUserCode` `/v1/mobile/admin/system-users/code/regenerate` (`lib/src/core/api/admin/mobile_api_admin_users_workers_MobileApiAdminUsersWorkers_methods_01.dart:245`). partial — `src/admin/adminWorkerDetailApi.ts`.
- [ ] `adminRegenerateWerkaCode` `/v1/mobile/admin/werka/code/regenerate` (`lib/src/core/api/admin/mobile_api_admin_production_map_MobileApiAdminProductionMap_methods_01.dart:5`). partial — `src/admin/adminWerkaApi.ts`.
- [ ] `adminRegenerateWorkerCode` `/v1/mobile/admin/workers/code/regenerate` (`lib/src/core/api/admin/mobile_api_admin_users_workers_MobileApiAdminUsersWorkers_methods_02.dart:156`). partial — `src/admin/adminWorkerDetailApi.ts`.
- [ ] `adminRemoveCustomer` `/v1/mobile/admin/customers/remove` (`lib/src/core/api/admin/mobile_api_admin_suppliers_customers_MobileApiAdminSuppliersCustomers_methods_01.dart:358`). partial — `src/admin/adminCustomerDetailApi.ts`.
- [ ] `adminRemoveCustomerItem` `/v1/mobile/admin/customers/items/remove` (`lib/src/core/api/admin/mobile_api_admin_items_MobileApiAdminItems_methods_01.dart:122`). partial — `src/admin/adminCustomerDetailApi.ts`.
- [ ] `adminRemoveSupplier` `/v1/mobile/admin/suppliers/remove` (`lib/src/core/api/admin/mobile_api_admin_suppliers_customers_MobileApiAdminSuppliersCustomers_methods_02.dart:211`). partial — `src/admin/adminSupplierDetailApi.ts`.
- [ ] `adminRemoveSupplierItem` `/v1/mobile/admin/suppliers/items/remove` (`lib/src/core/api/admin/mobile_api_admin_suppliers_customers_MobileApiAdminSuppliersCustomers_methods_02.dart:191`). partial — `src/admin/adminSupplierItemsApi.ts`.
- [ ] `adminRePauseResumedWork` `/v1/mobile/admin/production-maps/re-pause` (`lib/src/core/api/admin/mobile_api_re_pause.dart:38`). partial — `src/workerControlsApi.ts`.
- [ ] `adminReplaceFactoryLocationApparatus` `/v1/mobile/admin/factory-locations` (`lib/src/core/api/admin/mobile_api_factory_locations.dart:176`). partial — `src/admin/factoryLocationApi.ts`.
- [ ] `adminResetOrders` `/v1/mobile/admin/emergency-reset/orders` (`lib/src/core/api/admin/mobile_api_admin_production_map_MobileApiAdminProductionMap_methods_01.dart:20`). missing — no direct V4 counterpart identified.
- [ ] `adminRestartTraining` `/v1/mobile/admin/training/restart` (`lib/src/core/api/admin/mobile_api_admin_training_MobileApiAdminTrainingWorkspace_methods_01.dart:94`). missing — no direct V4 counterpart identified.
- [ ] `adminRestoreSupplier` `/v1/mobile/admin/suppliers/restore` (`lib/src/core/api/admin/mobile_api_admin_suppliers_customers_MobileApiAdminSuppliersCustomers_methods_02.dart:225`). partial — `src/admin/adminSupplierDetailApi.ts`.
- [ ] `adminReturnScannedWip` `/v1/mobile/admin/production-maps/scanned-wips/return` (`lib/src/core/api/admin/mobile_api_scanned_wip.dart:112`). partial — `src/scannedWipApi.ts`.
- [ ] `adminRezkaAstatkaReport` `/v1/mobile/admin/production-maps/rezka-astatka` (`lib/src/core/api/admin/mobile_api_admin_order_lifecycle_MobileApiAdminOrderLifecycle_methods_02.dart:65`). partial — `src/rezkaAstatkaApi.ts`.
- [ ] `adminRezkaAstatkaSnapshot` `/v1/mobile/admin/production-maps/rezka-astatka` (`lib/src/core/api/admin/mobile_api_admin_order_lifecycle_MobileApiAdminOrderLifecycle_methods_02.dart:5`). partial — `src/rezkaAstatkaApi.ts`.
- [ ] `adminRezkaOutputReport` `/v1/mobile/admin/production-maps/rezka-output-report` (`lib/src/core/api/admin/mobile_api_admin_rezka_output_report.dart:58`). partial — `src/rezkaOutputReportApi.ts`.
- [ ] `adminRoleAssignments` `/v1/mobile/admin/role-assignments` (`lib/src/core/api/admin/mobile_api_admin_users_workers_MobileApiAdminUsersWorkers_methods_01.dart:43`). partial — `src/admin/adminUsersApi.ts`.
- [ ] `adminRoles` `/v1/mobile/admin/roles` (`lib/src/core/api/admin/mobile_api_admin_users_workers_MobileApiAdminUsersWorkers_methods_01.dart:5`). partial — `src/admin/adminRolesApi.ts`, `src/admin/adminUserCreateApi.ts`.
- [ ] `adminSaveApparatusCapacityProfile` `/v1/mobile/admin/production-maps/capacity` (`lib/src/core/api/admin/mobile_api_admin_capacity_schedule_declarations_part_02.dart:49`). partial — `src/admin/apparatusCapacityApi.ts`.
- [ ] `adminSaveApparatusDowntime` `/v1/mobile/admin/production-maps/capacity/downtime` (`lib/src/core/api/admin/mobile_api_admin_capacity_schedule_declarations_part_02.dart:104`). missing — no direct V4 counterpart identified.
- [ ] `adminSaveOpenedOrderEdit` `/v1/mobile/admin/production-maps/order-edit` (`lib/src/core/api/admin/mobile_api_opened_order_edit.dart:90`). missing — no direct V4 counterpart identified.
- [ ] `adminSaveProductionCombo` `/v1/mobile/admin/combos` (`lib/src/core/api/admin/mobile_api_admin_combos.dart:49`). partial — `src/admin/productionMapDraftApi.ts`.
- [ ] `adminSaveProductionMap` `/v1/mobile/admin/production-maps` (`lib/src/core/api/admin/mobile_api_admin_production_map_MobileApiAdminProductionMap_methods_01.dart:143`). partial — `src/admin/productionMapDraftApi.ts`, `src/material/materialSequenceApi.ts`.
- [ ] `adminSaveProductionMapWithOrder` `/v1/mobile/admin/production-maps/with-order` (`lib/src/core/api/admin/mobile_api_admin_production_map_MobileApiAdminProductionMap_methods_01.dart:201`). partial — `src/admin/productionMapDraftApi.ts`.
- [ ] `adminSaveRawMaterialRule` `/v1/mobile/admin/raw-material-rules` (`lib/src/core/api/admin/mobile_api_admin_raw_materials_MobileApiAdminRawMaterials_methods_01.dart:26`). partial — `src/admin/rawMaterialRulesApi.ts`.
- [ ] `adminSaveTrainingProductionMapWithOrder` `/v1/mobile/admin/training/production-maps/with-order` (`lib/src/core/api/admin/mobile_api_admin_training_MobileApiAdminTrainingWorkspace_methods_03.dart:68`). missing — no direct V4 counterpart identified.
- [ ] `adminSaveWorkerGroup` `/v1/mobile/admin/worker-groups` (`lib/src/core/api/admin/mobile_api_admin_users_workers_MobileApiAdminUsersWorkers_methods_02.dart:228`). partial — `src/admin/workerSettingsApi.ts`.
- [ ] `adminScannedWips` `/v1/mobile/admin/production-maps/scanned-wips` (`lib/src/core/api/admin/mobile_api_scanned_wip.dart:70`). partial — `src/scannedWipApi.ts`.
- [ ] `adminScheduleApparatusOrder` `/v1/mobile/admin/production-maps/schedule` (`lib/src/core/api/admin/mobile_api_admin_capacity_schedule_declarations_part_02.dart:147`). partial — `src/admin/apparatusCapacityApi.ts`.
- [ ] `adminServerMonitor` `/v1/mobile/admin/system/monitor` (`lib/src/core/api/admin/mobile_api_admin_settings_monitor_declarations_part_02.dart:58`). partial — `src/admin/serverMonitorApi.ts`.
- [ ] `adminServerMonitorLiveEvents`  (`lib/src/core/api/admin/mobile_api_admin_settings_monitor_declarations_part_02.dart:408`). missing — no direct V4 counterpart identified.
- [ ] `adminServerMonitorLiveUri` `/v1/mobile/admin/system/monitor/live` (`lib/src/core/api/admin/mobile_api_admin_settings_monitor_declarations_part_02.dart:398`). partial — `src/admin/serverMonitorApi.ts`.
- [ ] `adminSetItemCustomerAssigned`  (`lib/src/core/api/admin/mobile_api_admin_items_MobileApiAdminItems_methods_05.dart:95`). partial — `src/admin/adminItemDetailApi.ts`.
- [ ] `adminSetSupplierBlocked` `/v1/mobile/admin/suppliers/status` (`lib/src/core/api/admin/mobile_api_admin_suppliers_customers_MobileApiAdminSuppliersCustomers_methods_02.dart:68`). partial — `src/admin/adminSupplierDetailApi.ts`.
- [ ] `adminSettings` `/v1/mobile/admin/settings` (`lib/src/core/api/admin/mobile_api_admin_settings_monitor_declarations_part_02.dart:7`). partial — `src/admin/adminSettings.ts`.
- [ ] `adminSetTrainingApparatusMode` `/v1/mobile/admin/training/apparatus` (`lib/src/core/api/admin/mobile_api_admin_training_MobileApiAdminTrainingWorkspace_methods_01.dart:50`). partial — `src/admin/canonicalApparatusMutationApi.ts`.
- [ ] `adminStageParticipants` `/v1/mobile/admin/production-maps/stage-participants` (`lib/src/core/api/admin/mobile_api_admin_stage_participants.dart:30`). missing — no direct V4 counterpart identified.
- [ ] `adminStartBackup` `/v1/mobile/admin/system/backups` (`lib/src/core/api/admin/mobile_api_admin_settings_monitor_declarations_part_02.dart:149`). partial — `src/admin/serverMonitorApi.ts`.
- [ ] `adminSubmitLaminationAstatka` `/v1/mobile/admin/production-maps/laminatsiya-astatka` (`lib/src/core/api/admin/mobile_api_admin_layer_remainders.dart:422`). partial — `src/laminationAstatkaSubmitApi.ts`.
- [ ] `adminSupplierDetail` `/v1/mobile/admin/suppliers/detail` (`lib/src/core/api/admin/mobile_api_admin_suppliers_customers_MobileApiAdminSuppliersCustomers_methods_01.dart:93`). partial — `src/admin/adminSupplierDetailApi.ts`.
- [ ] `adminSuppliers` `/v1/mobile/admin/suppliers/list` (`lib/src/core/api/admin/mobile_api_admin_suppliers_customers_MobileApiAdminSuppliersCustomers_methods_01.dart:28`). partial — `src/admin/adminRolesApi.ts`.
- [ ] `adminSupplierSummary` `/v1/mobile/admin/suppliers/summary` (`lib/src/core/api/admin/mobile_api_admin_suppliers_customers_MobileApiAdminSuppliersCustomers_methods_01.dart:56`). partial — `src/admin/adminSupplierSummary.ts`.
- [ ] `adminSystemUserDetail` `/v1/mobile/admin/system-users/detail` (`lib/src/core/api/admin/mobile_api_admin_users_workers_MobileApiAdminUsersWorkers_methods_01.dart:211`). partial — `src/admin/adminWorkerDetailApi.ts`.
- [ ] `adminTelegramOverview` `/v1/mobile/admin/telegram/settings` (`lib/src/core/api/admin/mobile_api_admin_telegram.dart:28`). missing — no direct V4 counterpart identified.
- [ ] `adminTemporarilyPauseWork` `/v1/mobile/admin/production-maps/temporary-pause` (`lib/src/core/api/admin/mobile_api_temporary_pause.dart:29`). partial — `src/workerControlsApi.ts`.
- [ ] `adminTrainingApparatus`  (`lib/src/core/api/admin/mobile_api_admin_training_MobileApiAdminTrainingWorkspace_methods_01.dart:5`). missing — no direct V4 counterpart identified.
- [ ] `adminTrainingApparatusModes` `/v1/mobile/admin/training/apparatus` (`lib/src/core/api/admin/mobile_api_admin_training_MobileApiAdminTrainingWorkspace_methods_01.dart:17`). partial — `src/admin/canonicalApparatusMutationApi.ts`.
- [ ] `adminTrainingCompletedProductionMapOrders` `/v1/mobile/admin/training/completed-orders` (`lib/src/core/api/admin/mobile_api_admin_training_MobileApiAdminTrainingWorkspace_methods_01.dart:188`). missing — no direct V4 counterpart identified.
- [ ] `adminTrainingInputBatches` `/v1/mobile/admin/training/input-batches` (`lib/src/core/api/admin/mobile_api_admin_training_MobileApiAdminTrainingWorkspace_methods_02.dart:5`). missing — no direct V4 counterpart identified.
- [ ] `adminTrainingOrderStatuses` `/v1/mobile/admin/training/statuses` (`lib/src/core/api/admin/mobile_api_admin_training_MobileApiAdminTrainingWorkspace_methods_01.dart:235`). missing — no direct V4 counterpart identified.
- [ ] `adminTrainingProductionMaps` `/v1/mobile/admin/training/production-maps` (`lib/src/core/api/admin/mobile_api_admin_training_MobileApiAdminTrainingWorkspace_methods_01.dart:323`). missing — no direct V4 counterpart identified.
- [ ] `adminTrainingRawMaterialAssignments` `/v1/mobile/admin/training/raw-material-assignments` (`lib/src/core/api/admin/mobile_api_admin_training_MobileApiAdminTrainingWorkspace_methods_02.dart:350`). missing — no direct V4 counterpart identified.
- [ ] `adminTransferProductionMapOrder` `/v1/mobile/admin/production-maps/apparatus-transfer` (`lib/src/core/api/admin/mobile_api_admin_production_map_MobileApiAdminProductionMap_methods_02.dart:118`). partial — `src/productionMapTransferApi.ts`.
- [ ] `adminUnassignWarehouse` `/v1/mobile/admin/warehouses/assignments` (`lib/src/core/api/admin/mobile_api_admin_items_MobileApiAdminItems_methods_03.dart:316`). partial — `src/admin/adminWarehouseSettingsApi.ts`.
- [ ] `adminUnlinkRawMaterialAssignment` `/v1/mobile/admin/raw-material-assignments` (`lib/src/core/api/admin/mobile_api_admin_raw_materials_MobileApiAdminRawMaterials_methods_03.dart:112`). partial — `src/rawMaterialUnlinkApi.ts`.
- [ ] `adminUpdateApparatusCollection`  (`lib/src/core/api/admin/mobile_api_admin_items_MobileApiAdminItems_methods_02.dart:60`). partial — `src/admin/apparatusCollection.ts`.
- [ ] `adminUpdateApparatusQueuePolicy` `/v1/mobile/admin/production-maps/queue-policies` (`lib/src/core/api/admin/mobile_api_admin_queue_state_models_part_02.dart:261`). partial — `src/admin/adminQueuePolicyApi.ts`.
- [ ] `adminUpdateCustomerPhone` `/v1/mobile/admin/customers/phone` (`lib/src/core/api/admin/mobile_api_admin_suppliers_customers_MobileApiAdminSuppliersCustomers_methods_01.dart:319`). partial — `src/admin/adminCustomerDetailApi.ts`.
- [ ] `adminUpdateFactoryLocation` `/v1/mobile/admin/factory-locations` (`lib/src/core/api/admin/mobile_api_factory_locations.dart:101`). partial — `src/admin/factoryLocationApi.ts`.
- [ ] `adminUpdateItem` `/v1/mobile/admin/items/detail` (`lib/src/core/api/admin/mobile_api_admin_items_MobileApiAdminItems_methods_05.dart:5`). partial — `src/admin/adminItemDetailApi.ts`.
- [ ] `adminUpdateItemGroup`  (`lib/src/core/api/admin/mobile_api_admin_items_MobileApiAdminItems_methods_05.dart:48`). partial — `src/admin/adminItemDetailApi.ts`.
- [ ] `adminUpdateMaterialTaminotchiItemGroups` `/v1/mobile/admin/material-taminotchilar/item-groups` (`lib/src/core/api/admin/mobile_api_admin_suppliers_customers_MobileApiAdminSuppliersCustomers_methods_01.dart:256`). partial — `src/admin/adminCustomerDetailApi.ts`.
- [ ] `adminUpdateRawMaterialStock` `/v1/mobile/admin/raw-material-stock` (`lib/src/core/api/admin/mobile_api_admin_items_MobileApiAdminItems_methods_02.dart:265`). partial — `src/admin/rawMaterialStockApi.ts`.
- [ ] `adminUpdateSupplierPhone` `/v1/mobile/admin/suppliers/phone` (`lib/src/core/api/admin/mobile_api_admin_suppliers_customers_MobileApiAdminSuppliersCustomers_methods_02.dart:90`). partial — `src/admin/adminSupplierDetailApi.ts`.
- [ ] `adminUpdateSystemUserPhone` `/v1/mobile/admin/system-users` (`lib/src/core/api/admin/mobile_api_admin_users_workers_MobileApiAdminUsersWorkers_methods_01.dart:177`). partial — `src/admin/adminWorkerDetailApi.ts`.
- [ ] `adminUpdateWorkerLevel` `/v1/mobile/admin/workers` (`lib/src/core/api/admin/mobile_api_admin_users_workers_MobileApiAdminUsersWorkers_methods_01.dart:283`). partial — `src/admin/adminWorkerDetailApi.ts`, `src/admin/workerSettingsApi.ts`.
- [ ] `adminUpdateWorkerName` `/v1/mobile/admin/workers` (`lib/src/core/api/admin/mobile_api_admin_users_workers_MobileApiAdminUsersWorkers_methods_01.dart:312`). partial — `src/admin/adminWorkerDetailApi.ts`, `src/admin/workerSettingsApi.ts`.
- [ ] `adminUpdateWorkerPhone` `/v1/mobile/admin/workers` (`lib/src/core/api/admin/mobile_api_admin_users_workers_MobileApiAdminUsersWorkers_methods_01.dart:349`). partial — `src/admin/adminWorkerDetailApi.ts`.
- [ ] `adminUpsertRole` `/v1/mobile/admin/roles` (`lib/src/core/api/admin/mobile_api_admin_users_workers_MobileApiAdminUsersWorkers_methods_01.dart:26`). partial — `src/admin/adminRolesApi.ts`.
- [ ] `adminUpsertRoleAssignment` `/v1/mobile/admin/role-assignments` (`lib/src/core/api/admin/mobile_api_admin_users_workers_MobileApiAdminUsersWorkers_methods_02.dart:362`). partial — `src/admin/adminCustomerDetailApi.ts`.
- [ ] `adminUserList` `/v1/mobile/admin/users/list` (`lib/src/core/api/admin/mobile_api_admin_users_list.dart:4`). partial — `src/admin/adminUsersApi.ts`.
- [ ] `adminValidateProductionMapQolipDetails` `/v1/mobile/admin/production-maps/qolip-validate` (`lib/src/core/api/admin/mobile_api_admin_qolip_orders.dart:217`). partial — `src/qolipValidationApi.ts`.
- [ ] `adminWarehouseAssignments` `/v1/mobile/admin/warehouses/assignments` (`lib/src/core/api/admin/mobile_api_admin_items_MobileApiAdminItems_methods_03.dart:219`). partial — `src/admin/adminWarehouseSettingsApi.ts`, `src/shared/catalogApi.ts`.
- [ ] `adminWarehouseItemRolls` `/v1/mobile/admin/warehouses/items/rolls` (`lib/src/core/api/admin/mobile_api_admin_items_MobileApiAdminItems_methods_01.dart:264`). partial — `src/admin/warehouseStockApi.ts`.
- [ ] `adminWarehouseItemsPage` `/v1/mobile/admin/warehouses/items` (`lib/src/core/api/admin/mobile_api_admin_items_MobileApiAdminItems_methods_01.dart:219`). partial — `src/admin/warehouseStockApi.ts`.
- [ ] `adminWarehouseLiveEvents`  (`lib/src/core/api/mobile_api.dart:487`). partial — `src/admin/adminWarehouseLiveTransport.ts`.
- [ ] `adminWarehouseLiveUri` `/v1/mobile/admin/warehouses/live` (`lib/src/core/api/mobile_api.dart:477`). partial — `src/admin/adminWarehouseLiveTransport.ts`.
- [ ] `adminWarehouses` `/v1/mobile/admin/warehouses` (`lib/src/core/api/admin/mobile_api_admin_items_MobileApiAdminItems_methods_01.dart:313`). partial — `src/admin/adminWorkerDetailAssignmentsApi.ts`, `src/gscale/gscaleAdminApi.ts`.
- [ ] `adminWarehouseSummaries` `/v1/mobile/admin/warehouses/summary` (`lib/src/core/api/admin/mobile_api_admin_items_MobileApiAdminItems_methods_02.dart:193`). partial — `src/admin/warehouseApi.ts`.
- [ ] `adminWipBatches` `/v1/mobile/admin/production-maps/wip-batches` (`lib/src/core/api/admin/mobile_api_admin_order_lifecycle_MobileApiAdminOrderLifecycle_methods_01.dart:5`). partial — `src/workerWipApi.ts`.
- [ ] `adminWorkerDeletionCheck` `/v1/mobile/admin/workers/delete-check` (`lib/src/core/api/admin/mobile_api_admin_users_workers_MobileApiAdminUsersWorkers_methods_02.dart:36`). missing — no direct V4 counterpart identified.
- [ ] `adminWorkerDetail` `/v1/mobile/admin/workers/detail` (`lib/src/core/api/admin/mobile_api_admin_users_workers_MobileApiAdminUsersWorkers_methods_01.dart:382`). partial — `src/admin/adminWorkerDetailApi.ts`.
- [ ] `adminWorkerGroups` `/v1/mobile/admin/worker-groups` (`lib/src/core/api/admin/mobile_api_admin_users_workers_MobileApiAdminUsersWorkers_methods_02.dart:192`). partial — `src/admin/workerSettingsApi.ts`.
- [ ] `adminWorkerProfileDetail` `/v1/mobile/admin/workers/profile-detail` (`lib/src/core/api/admin/mobile_api_admin_users_workers_MobileApiAdminUsersWorkers_methods_02.dart:5`). partial — `src/admin/adminWorkerDetailApi.ts`.
- [ ] `adminWorkers` `/v1/mobile/admin/workers` (`lib/src/core/api/admin/mobile_api_admin_users_workers_MobileApiAdminUsersWorkers_methods_01.dart:64`). partial — `src/admin/adminWorkerDetailApi.ts`, `src/admin/workerSettingsApi.ts`.
- [ ] `adminWorkReactivationPreview` `/v1/mobile/admin/production-maps` (`lib/src/core/api/admin/mobile_api_reactivation.dart:89`). partial — `src/workerControlsApi.ts`.
- [ ] `cachedOrderImageBytes`  (`lib/src/core/api/admin/mobile_api_order_images.dart:65`). partial — `src/orderImageApi.ts`.
- [ ] `calculate` `/v1/mobile/calculate` (`lib/src/core/api/calculate/mobile_api_calculate_models_part_01.dart:34`). partial — `src/calculateApi.ts`.
- [ ] `calculateMaterials` `/v1/mobile/admin/calculate-materials` (`lib/src/core/api/calculate/mobile_api_calculate_models_part_01.dart:63`). partial — `src/admin/adminWorkerDetailAssignmentsApi.ts`.
- [ ] `calculateOrderImageUrl`  (`lib/src/core/api/calculate/mobile_api_calculate_models_part_01.dart:328`). partial — `src/orderImageUri.ts`.
- [ ] `calculateOrderTemplates` `/v1/mobile/calculate/orders` (`lib/src/core/api/calculate/mobile_api_calculate_models_part_01.dart:198`). partial — `src/admin/calculateOrderTemplateApi.ts`.
- [ ] `cancelTelegramQrLogin` `/v1/mobile/admin/telegram/qr-logins/{}` (`lib/src/core/api/admin/mobile_api_admin_telegram.dart:141`). missing — no direct V4 counterpart identified.
- [ ] `checkAdminPushConfig` `/v1/mobile/{}push-config{}` (`lib/src/core/api/admin/mobile_api_push_config.dart:65`). partial — `src/admin/adminPushConfigApi.ts`.
- [ ] `confirmServerEndpointWithoutLogin`  (`lib/src/core/api/server/mobile_api_server.dart:204`). missing — no direct V4 counterpart identified.
- [ ] `createTelegramInvite` `/v1/mobile/admin/telegram/invites` (`lib/src/core/api/admin/mobile_api_admin_telegram.dart:93`). missing — no direct V4 counterpart identified.
- [ ] `deleteCalculateOrderTemplate` `/v1/mobile/calculate/orders/delete` (`lib/src/core/api/calculate/mobile_api_calculate_models_part_01.dart:264`). partial — `src/admin/calculateOrderTemplateApi.ts`.
- [ ] `deleteTelegramUser` `/v1/mobile/admin/telegram/users/{}` (`lib/src/core/api/admin/mobile_api_admin_telegram.dart:149`). missing — no direct V4 counterpart identified.
- [ ] `gscaleMaterialTasks` `/v1/mobile/gscale/material-tasks` (`lib/src/core/api/gscale/mobile_api_gscale_declarations_part_01.dart:5`). partial — `src/gscale/gscaleBatchApi.ts`.
- [ ] `invalidateProductionComboCatalog`  (`lib/src/core/api/admin/mobile_api_admin_combos.dart:43`). missing — no direct V4 counterpart identified.
- [ ] `inventoryCreateTransfer` `/v1/mobile/admin/inventory/transfers` (`lib/src/core/api/admin/mobile_api_inventory_movements_MobileApiInventoryMovements_methods_02.dart:176`). partial — `src/preparation/preparationInventoryTransfers.ts`.
- [ ] `inventoryRelocate` `/v1/mobile/admin/inventory/relocations` (`lib/src/core/api/admin/mobile_api_inventory_movements_MobileApiInventoryMovements_methods_01.dart:151`). partial — `src/inventoryRelocateApi.ts`.
- [ ] `inventoryRelocateBatch` `/v1/mobile/admin/inventory/relocations/batch` (`lib/src/core/api/admin/mobile_api_inventory_movements_MobileApiInventoryMovements_methods_01.dart:240`). partial — `src/shared/inventoryMovementApi.ts`.
- [ ] `inventoryTransferAction` `/v1/mobile/admin/inventory/transfers` (`lib/src/core/api/admin/mobile_api_inventory_movements_MobileApiInventoryMovements_methods_03.dart:5`). partial — `src/preparation/preparationInventoryTransfers.ts`.
- [ ] `laminationLabelSettings` `/v1/mobile/admin/production-maps/lamination-settings` (`lib/src/core/api/admin/mobile_api_admin_layer_remainders.dart:337`). partial — `src/admin/productionSettingsApi.ts`.
- [ ] `mandatoryAppUpdatesEnabled` `/v1/mobile/admin/app-update/settings` (`lib/src/core/api/admin/mobile_api_admin_app_update_settings.dart:4`). partial — `src/admin/appUpdateSettingsApi.ts`.
- [ ] `orderImageAccountScope`  (`lib/src/core/api/admin/mobile_api_order_images.dart:4`). partial — `src/orderImageApi.ts`.
- [ ] `orderImageCacheScope`  (`lib/src/core/api/admin/mobile_api_order_images.dart:10`). partial — `src/orderImageApi.ts`.
- [ ] `orderImageRequestUri`  (`lib/src/core/api/admin/mobile_api_order_images.dart:24`). partial — `src/orderImageUri.ts`.
- [ ] `orderPrintSidePreference` `/v1/mobile/calculate/print-side` (`lib/src/core/api/admin/mobile_api_rezka_master.dart:4`). partial — `src/admin/productionMapDraftApi.ts`.
- [ ] `paddonManagementSettings` `/v1/mobile/admin/production-maps/paddons/management-settings` (`lib/src/core/api/admin/mobile_api_paddons.dart:189`). partial — `src/admin/productionSettingsApi.ts`.
- [ ] `peekCachedOrderImageBytes`  (`lib/src/core/api/admin/mobile_api_order_images.dart:47`). partial — `src/orderImageApi.ts`.
- [ ] `pendingOrderDetail` `/v1/mobile/admin/pending-orders` (`lib/src/core/api/admin/mobile_api_admin_order_page.dart:747`). partial — `src/pendingOrderApi.ts`.
- [ ] `pendingOrderImage` `/v1/mobile/admin/pending-orders/image` (`lib/src/core/api/admin/mobile_api_pending_orders.dart:44`). missing — no direct V4 counterpart identified.
- [ ] `pendingOrders` `/v1/mobile/admin/pending-orders` (`lib/src/core/api/admin/mobile_api_pending_orders.dart:29`). partial — `src/pendingOrderApi.ts`.
- [ ] `pollTelegramQrLogin` `/v1/mobile/admin/telegram/qr-logins/{}` (`lib/src/core/api/admin/mobile_api_admin_telegram.dart:120`). missing — no direct V4 counterpart identified.
- [ ] `preparationAssignResponsibility` `/v1/mobile/admin/preparation/responsibilities` (`lib/src/core/api/preparation/mobile_api_preparation.dart:641`). partial — `src/admin/adminWorkerDetailAssignmentsApi.ts`.
- [ ] `preparationOrderDetail` `/v1/mobile/preparation/orders/{}` (`lib/src/core/api/preparation/mobile_api_preparation_orders.dart:345`). partial — `src/preparation/preparationOrdersApi.ts`.
- [ ] `preparationOrderMaterials` `/v1/mobile/preparation/order-materials` (`lib/src/core/api/preparation/mobile_api_preparation.dart:573`). partial — `src/preparationReadApi.ts`.
- [ ] `preparationOrders` `/v1/mobile/preparation/orders` (`lib/src/core/api/preparation/mobile_api_preparation_orders.dart:281`). partial — `src/preparation/preparationOrdersApi.ts`.
- [ ] `preparationOrdersLive` `/v1/mobile/preparation/orders/live` (`lib/src/core/api/preparation/mobile_api_preparation_orders.dart:376`). partial — `src/preparation/preparationOrdersLive.ts`.
- [ ] `preparationResponsibilities` `/v1/mobile/admin/preparation/responsibilities` (`lib/src/core/api/preparation/mobile_api_preparation.dart:616`). partial — `src/admin/adminWorkerDetailAssignmentsApi.ts`.
- [ ] `preparationSnapshot` `/v1/mobile/preparation/snapshot` (`lib/src/core/api/preparation/mobile_api_preparation.dart:27`). partial — `src/preparationReadApi.ts`.
- [ ] `preparationUnassignResponsibility` `/v1/mobile/admin/preparation/responsibilities` (`lib/src/core/api/preparation/mobile_api_preparation.dart:662`). partial — `src/admin/adminWorkerDetailAssignmentsApi.ts`.
- [ ] `qolipOrderProducts` `/v1/mobile/qolip/order-products` (`lib/src/core/api/qolip/mobile_api_qolip_order_products.dart:4`). partial — `src/qolipOrderProductsApi.ts`.
- [ ] `qolipPrintCodeQr` `/v1/mobile/qolip/code-qr/print` (`lib/src/core/api/qolip/mobile_api_qolip_MobileApiQolip_methods_04.dart:162`). partial — `src/shared/printApi.ts`.
- [ ] `qolipProductMolds` `/v1/mobile/qolip/shared-sets` (`lib/src/core/api/qolip/mobile_api_qolip_shared_sets.dart:347`). partial — `src/qolipCatalogApi.ts`.
- [ ] `qolipStartSettings` `/v1/mobile/admin/production-maps/qolip-start-settings` (`lib/src/core/api/admin/mobile_api_qolip_start_settings.dart:105`). partial — `src/admin/qolipStartSettingsApi.ts`.
- [ ] `reorderCalculateMaterials` `/v1/mobile/admin/calculate-materials/sequence` (`lib/src/core/api/calculate/mobile_api_calculate_models_part_01.dart:149`). partial — `src/admin/calculateMaterialCommands.ts`.
- [ ] `rezkaMasterAssignWorker` `/v1/mobile/rezka-master/{}` (`lib/src/core/api/admin/mobile_api_rezka_master.dart:60`). partial — `src/rezka/rezkaMasterApi.ts`.
- [ ] `rezkaMasterSaveOrderSettings` `/v1/mobile/rezka-master/{}` (`lib/src/core/api/admin/mobile_api_rezka_master.dart:71`). partial — `src/rezka/rezkaMasterApi.ts`.
- [ ] `rezkaMasterSavePrintSide` `/v1/mobile/rezka-master/{}` (`lib/src/core/api/admin/mobile_api_rezka_master.dart:23`). partial — `src/rezkaMasterSettingsApi.ts`.
- [ ] `saveAdminPushConfig` `/v1/mobile/{}push-config{}` (`lib/src/core/api/admin/mobile_api_push_config.dart:44`). partial — `src/admin/adminPushConfigApi.ts`.
- [ ] `saveMobilePushConfig` `/v1/mobile/{}push-config{}` (`lib/src/core/api/admin/mobile_api_push_config.dart:50`). partial — `src/admin/adminPushConfigApi.ts`.
- [ ] `setActiveRezkaPaddon` `/v1/mobile/admin/production-maps/paddons/active` (`lib/src/core/api/admin/mobile_api_paddons.dart:318`). partial — `src/activePaddonSetApi.ts`.
- [ ] `setLaminationLabelSettings` `/v1/mobile/admin/production-maps/lamination-settings` (`lib/src/core/api/admin/mobile_api_admin_layer_remainders.dart:346`). partial — `src/admin/productionSettingsApi.ts`.
- [ ] `setMandatoryAppUpdatesEnabled` `/v1/mobile/admin/app-update/settings` (`lib/src/core/api/admin/mobile_api_admin_app_update_settings.dart:12`). partial — `src/admin/appUpdateSettingsApi.ts`.
- [ ] `setQolipAutomaticConfirmationEnabled` `/v1/mobile/admin/production-maps/qolip-start-settings` (`lib/src/core/api/admin/mobile_api_qolip_start_settings.dart:114`). partial — `src/admin/qolipStartSettingsApi.ts`.
- [ ] `startTelegramQrLogin` `/v1/mobile/admin/telegram/qr-logins` (`lib/src/core/api/admin/mobile_api_admin_telegram.dart:110`). missing — no direct V4 counterpart identified.
- [ ] `submitTelegramQrPassword` `/v1/mobile/admin/telegram/qr-logins/{}` (`lib/src/core/api/admin/mobile_api_admin_telegram.dart:129`). missing — no direct V4 counterpart identified.
- [ ] `supplierSummary` `/v1/mobile/supplier/summary` (`lib/src/core/api/supplier/mobile_api_supplier_notifications.dart:22`). partial — `src/supplier/supplierApi.ts`.
- [ ] `supplyTaskLive` `/v1/mobile/production-tasks/live` (`lib/src/core/api/admin/mobile_api_supply_tasks.dart:485`). partial — `src/material/materialTaskLive.ts`, `src/qolip/qolipTasksLive.ts`.
- [ ] `supplyTaskWindow` `/v1/mobile/production-tasks/window` (`lib/src/core/api/admin/mobile_api_supply_tasks.dart:439`). partial — `src/shared/supplyTasks/supplyTaskApi.ts`.
- [ ] `switchServerEndpoint` `/v1/mobile/server/handshake` (`lib/src/core/api/server/mobile_api_server.dart:60`). missing — no direct V4 counterpart identified.
- [ ] `testAdminPushConfig` `/v1/mobile/{}push-config{}` (`lib/src/core/api/admin/mobile_api_push_config.dart:68`). partial — `src/admin/adminPushConfigApi.ts`.
- [ ] `updateAdminSettings` `/v1/mobile/admin/settings` (`lib/src/core/api/admin/mobile_api_admin_settings_monitor_declarations_part_02.dart:25`). partial — `src/admin/adminSettings.ts`.
- [ ] `updatePaddonManagementSettings` `/v1/mobile/admin/production-maps/paddons/management-settings` (`lib/src/core/api/admin/mobile_api_paddons.dart:204`). partial — `src/admin/productionSettingsApi.ts`.
- [ ] `updateTelegramAlertSender` `/v1/mobile/admin/telegram/alert-settings` (`lib/src/core/api/admin/mobile_api_admin_telegram.dart:4`). missing — no direct V4 counterpart identified.
- [ ] `updateTelegramBotSettings` `/v1/mobile/admin/telegram/settings` (`lib/src/core/api/admin/mobile_api_admin_telegram.dart:46`). missing — no direct V4 counterpart identified.
- [ ] `updateTelegramUserbotSettings` `/v1/mobile/admin/telegram/userbot-settings` (`lib/src/core/api/admin/mobile_api_admin_telegram.dart:69`). missing — no direct V4 counterpart identified.
- [ ] `uploadCalculateOrderImage` `/v1/mobile/calculate/orders/image` (`lib/src/core/api/calculate/mobile_api_calculate_models_part_01.dart:295`). partial — `src/admin/productionMapDraftApi.ts`.
- [ ] `uploadTrainingCalculateOrderImage` `/v1/mobile/admin/training/images` (`lib/src/core/api/admin/mobile_api_admin_training_MobileApiAdminTrainingWorkspace_methods_03.dart:113`). partial — `src/boyoqchi/returnedPaintApi.ts`.
- [ ] `upsertCalculateMaterial` `/v1/mobile/admin/calculate-materials` (`lib/src/core/api/calculate/mobile_api_calculate_models_part_01.dart:90`). partial — `src/admin/adminWorkerDetailAssignmentsApi.ts`, `src/admin/calculateMaterialCommands.ts`.
- [ ] `upsertCalculateOrderTemplate` `/v1/mobile/calculate/orders` (`lib/src/core/api/calculate/mobile_api_calculate_models_part_01.dart:230`). partial — `src/admin/calculateOrderTemplateApi.ts`.
- [ ] `werkaCustomerItemOptions` `/v1/mobile/werka/customer-item-options` (`lib/src/core/api/werka/mobile_api_werka_MobileApiWerka_methods_01.dart:311`). partial — `src/werka/werkaCatalogApi.ts`.
- [ ] `werkaCustomerItems` `/v1/mobile/werka/customer-items` (`lib/src/core/api/werka/mobile_api_werka_MobileApiWerka_methods_01.dart:277`). partial — `src/werka/werkaCatalogApi.ts`.
- [ ] `werkaCustomers` `/v1/mobile/werka/customers` (`lib/src/core/api/werka/mobile_api_werka_MobileApiWerka_methods_01.dart:130`). partial — `src/werka/werkaDirectoryApi.ts`.
- [ ] `werkaCustomersForItem`  (`lib/src/core/api/werka/mobile_api_werka_MobileApiWerka_methods_01.dart:142`). partial — `src/werka/werkaCatalogApi.ts`.
- [ ] `workerProductionOrderDetail` `/v1/mobile/admin/production-maps/sequence` (`lib/src/core/api/admin/mobile_api_worker_order_list.dart:333`). partial — `src/workerDetailApi.ts`.

## Cross-cutting edge cases

- [ ] Exact signed-in and capability gates, Admin/Sales/Brigader home, and read-only Work Map presets.
- [ ] Session/account retirement invalidates pending reads, sheet results and writes.
- [ ] Pagination keeps V2 limits, offsets, reset points, sort order and retry behavior.
- [ ] Realtime and snapshot consumers preserve revision, fingerprint, reconnect and fallback rules.
- [ ] Mutations preserve V2 idempotency keys and retained command IDs.
- [ ] Persisted filters and order drafts use current profile keys with clean-session defaults.
- [ ] Match all localized states in Uzbek, Russian, English and Urdu, including explicit LTR values.
- [ ] Match source validation, cancellation and result ordering in dialogs and sheets.

## iOS TODO

- Item Groups tabs and item list (`src/admin/ItemGroupsRoute.android.tsx`).
- Activity list and retry typography (`src/admin/AdminActivityScreen.android.tsx`).
- Roles and Assignments tabs and list hosts (`src/admin/AdminRolesScreen.android.tsx`).
- Warehouses drawer route, list and both sets of tabs (`src/app/android-admin/warehouses.tsx`, `src/admin/AdminWarehouseMainScreen.android.tsx`).
- Factory Map route and its role shell (`src/app/android-admin/factory-map.tsx`, `src/admin/AdminHomeShortcutRoute.android.tsx`).
- Work Map tabs, apparatus selector, keyed pages and Move picker (`src/admin/AdminWorkMapRoute.android.tsx`, `src/admin/AdminWorkMap*.android.tsx`).
- Quick Orders, Open Order and calculation materials, including the private calculation result route (`src/app/android-admin/calculate*.tsx`, `src/app/android-admin/flow/[id].tsx`).
