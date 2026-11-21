# Accord Mobile V4 component catalog

## Reference implementations

- **Worker is V2 Aparatchi.** V2 `/apparatus-queue` builds `AdminProductionMapOrdersScreen(workerMode: true, readOnly: true)`. V4 maps that home to `/ios-worker` on iOS and the inline `WorkerScreen` branch of the root route on Android. V4's `rezka_master` has separate role routes which also reuse the Worker screen. `../accord_mobile_v2/lib/src/app/app_router_AppRouter_resplit_class_AppRouter_resplit2_static_methods_01.dart:404` · `src/shared/appRoutes.ts:720` · `src/shared/appRoutes.ts:732` · `src/app/index.tsx:37` · `src/app/ios-worker/(home)/index.tsx:7` · `src/app/ios-rezka/(home)/index.tsx:6`. 
- **Tayyorlov Masteri is V2's preparation workspace.** V2's `tayyorlovMasteri` with `preparation.access` opens `/preparation` and `PreparationScreen`. V4's platform routes resolve to `PreparationHomeScreen` on Android and `PreparationHome` on iOS. `../accord_mobile_v2/lib/src/core/session/state/app_session.dart:65` · `src/shared/appRoutes.ts:673` · `src/shared/appRoutes.ts:723` · `src/app/android-preparation/index.tsx:1` · `src/app/ios-preparation/(home)/index.tsx:1`.
- The recipes use V4 `77048e680a93` and V2 `052655a427e0` as source references. Paths are relative to the V4 repo unless prefixed `../accord_mobile_v2/`. The dictionary is in [COMPONENT_MAP.md](COMPONENT_MAP.md).

## A1. Component inventory

Scope includes exported render components and public UI aliases in `src/components/` and every `src/shared/` subfolder. It also includes the reference entry points, relevant role adapters and other `src/` exports with two or more static rendering files. A row groups same-name platform siblings. A common directory in a file cell applies to every listed basename.

Consumer totals count distinct V4 source files that render, forward or re-export the component. A consumer is counted once across the platform variants. Alias rows count references to that alias. Example lines show a real JSX reference where available. Dynamic dispatch and inline private widgets can add runtime consumers. “Compose”, “SwiftUI”, “Expo universal” and “RN” denote directly observed imports, or the target imports for an alias. Thin wrappers inherit their child's platform implementation.

| Name | File / declaration | Purpose | Platform split / implementation | Used by files · example |
| --- | --- | --- | --- | --- |
| `AccordListScrollReader` | `modules/accord-list-scroll/src/AccordListScrollReader.tsx:11` | Optional native list scroll proxy with children fallback. | base wrapper · iOS native view | 1 · `src/components/WorkerPaddonDetail.ios.tsx:58` |
| `AccountAccessScreen` | `src/components/` `AccountAccessScreen.android.tsx:12`, `AccountAccessScreen.ios.tsx:8` | Shows account access screen. Uses `ScrollView`, `Host`, `Button`. | android, ios · Compose / RN / SwiftUI | 1 · `src/app/index.tsx:48` |
| `AccountSwitcher` | `src/components/` `AccountSwitcher.android.tsx:12`, `AccountSwitcher.ios.tsx:12` | Renders account switcher content. Uses `Host`, `Button`. | android, ios · Compose / SwiftUI | 1 · `src/components/useAccountSwitcherLauncher.tsx:26` |
| `AccountSwitcherLayout` | `src/components/AccountSwitcherLayout.tsx:4` | Shows account switcher layout. Uses `ScrollView`. | base · RN | 2 · `src/components/AccountSwitcher.android.tsx:15` |
| `Action` | `src/brigader/` `BrigaderForm.android.tsx:20`, `BrigaderForm.ios.tsx:11` | Renders action content. | android, ios · Compose / SwiftUI | 22 · `src/brigader/BrigaderApparatusDetail.android.tsx:18` |
| `ActionRow` | `src/brigader/` `BrigaderForm.android.tsx:32`, `BrigaderForm.ios.tsx:20` | Shows action row. | android, ios · Compose / SwiftUI | 13 · `src/brigader/BrigaderApparatusDetail.android.tsx:26` |
| `AdminActivityRoute` | `src/admin/AdminActivityRouteCore.tsx:65` | Renders admin activity route content. | base · RN · Platform.OS | 5 · `src/app/android-brigader/activity.tsx:3` |
| `AdminAdditionalSettingsRoute` | `src/admin/AdminManagementRoutes.tsx:56` | Renders admin additional settings route content. | base · RN | 4 · `src/app/android-admin/additional-settings.tsx:5` |
| `AdminBottomBar` | `src/admin/AdminBottomBar.android.tsx:15` | Shows admin bottom bar. | android · RN | 13 · `src/app/android-admin/additional-settings.tsx:5` |
| `AdminChatLayout` | `src/admin/AdminChatLayout.tsx:8` | Shows admin chat layout. | base | 2 · `src/app/android-admin/chat/_layout.tsx:3` |
| `AdminClosedLogIcon` | `src/admin/AdminClosedHistoryAccessories.tsx:18` | Renders admin closed log icon content. | base · RN | 2 · `src/admin/AdminClosedHistoryContent.android.tsx:24` |
| `AdminClosedRank` | `src/admin/AdminClosedHistoryAccessories.tsx:14` | Renders admin closed rank content. | base · RN | 6 · `src/admin/AdminClosedHistoryContent.android.tsx:14` |
| `AdminCreateHubFloating` | `src/admin/AdminCreateHubFloating.tsx:74` | Renders admin create hub floating content. | base · RN | 2 · `src/admin/AdminCreateHubHost.android.tsx:16` |
| `AdminCreateHubHost` | `src/admin/` `AdminCreateHubHost.android.tsx:14`, `AdminCreateHubHost.ios.tsx:13` | Renders admin create hub host content. Uses `Button`. | android, ios · Compose / RN / SwiftUI | 3 · `src/admin/AdminCreateHubProvider.tsx:43` |
| `AdminCreateMenu` | `src/admin/` `AdminCreateMenu.android.tsx:41`, `AdminCreateMenu.ios.tsx:7` | Shows admin create menu. Uses `Pressable`, `ScrollView`, `Host`. | android, ios · Compose / RN / SwiftUI | 6 · `src/admin/AdminWarehouseMainScreen.android.tsx:177` |
| `AdminCustomerApparatusCard` | `src/admin/` `AdminCustomerApparatusCard.android.tsx:51`, `AdminCustomerApparatusCard.ios.tsx:46` | Shows admin customer apparatus card. Uses `Picker`, `Button`. | android, ios · Compose / RN / SwiftUI | 2 · `src/admin/AdminCustomerDetailWithAssignments.android.tsx:10` |
| `AdminCustomerDetailScreen` | `src/admin/` `AdminCustomerDetailScreen.android.tsx:49`, `AdminCustomerDetailScreen.ios.tsx:44` | Shows admin customer detail screen. Uses `ScrollView`. | android, ios · Compose / RN / SwiftUI | 4 · `src/admin/AdminCustomerDetailWithAssignments.android.tsx:9` |
| `AdminCustomerDetailWithAssignments` | `src/admin/` `AdminCustomerDetailWithAssignments.android.tsx:8`, `AdminCustomerDetailWithAssignments.ios.tsx:8` | Renders admin customer detail with assignments content. | android, ios | 2 · `src/admin/AdminOwnedRouteContent.android.tsx:32` |
| `AdminCustomerMaterialWarehouseEditor` | `src/admin/` `AdminCustomerMaterialWarehouseEditor.android.tsx:13`, `AdminCustomerMaterialWarehouseEditor.ios.tsx:11` | Renders admin customer material warehouse editor content. | android, ios · Compose / RN / SwiftUI | 2 · `src/admin/AdminCustomerDetailWithAssignments.android.tsx:10` |
| `AdminDrawer` | `src/admin/AdminDrawer.tsx:19` | Adapts Admin destinations and route state to the shared RoleDrawer. | base · RN · Platform.OS | 4 · `src/admin/AdminLayout.android.tsx:27` |
| `AdminFactoryLocationsRoute` | `src/admin/AdminFactoryLocationsRouteCore.tsx:17` | Renders admin factory locations route content. | base · RN · Platform.OS | 4 · `src/app/android-admin/factory-locations.tsx:5` |
| `AdminHomeScreen` | `src/admin/` `AdminHomeScreen.android.tsx:22`, `AdminHomeScreen.ios.tsx:21` | Shows admin home screen. Uses `ScrollView`. | android, ios · Compose / RN / SwiftUI / Expo universal | 4 · `src/admin/AdminHomeRoute.android.tsx:17` |
| `AdminHomeShortcutRoute` | `src/admin/` `AdminHomeShortcutRoute.android.tsx:10`, `AdminHomeShortcutRoute.ios.tsx:8` | Renders admin home shortcut route content. | android, ios · RN | 6 · `src/app/android-admin/calculate-orders.tsx:5` |
| `AdminInactiveSuppliersRoute` | `src/admin/AdminManagementRoutes.tsx:73` | Renders admin inactive suppliers route content. | base · RN | 4 · `src/app/android-admin/inactive-suppliers.tsx:5` |
| `AdminItemCreateDialogCard` | `src/admin/` `AdminItemCreateDialogCard.android.tsx:38`, `AdminItemCreateDialogCard.ios.tsx:33` | Shows admin item create dialog card. Uses `ScrollView`, `Button`. | android, ios · Compose / RN / SwiftUI | 2 · `src/admin/AdminItemCreateOverlays.android.tsx:24` |
| `AdminItemCreateHeader` | `src/admin/` `AdminItemCreateHeader.android.tsx:26`, `AdminItemCreateHeader.ios.tsx:10` | Shows admin item create header. | android, ios · Compose / RN | 2 · `src/admin/AdminItemCreateScreen.android.tsx:30` |
| `AdminItemCreateList` | `src/admin/` `AdminItemCreateList.android.tsx:54`, `AdminItemCreateList.ios.tsx:48` | Shows admin item create list. Uses `FlatList`. | android, ios · Compose / RN / SwiftUI | 2 · `src/admin/AdminItemCreateScreen.android.tsx:32` |
| `AdminItemCreateOverlays` | `src/admin/` `AdminItemCreateOverlays.android.tsx:17`, `AdminItemCreateOverlays.ios.tsx:24` | Renders admin item create overlays content. Uses `Button`. | android, ios · Compose / RN / SwiftUI | 2 · `src/admin/AdminItemCreateScreen.android.tsx:35` |
| `AdminItemCreatePicker` | `src/admin/` `AdminItemCreatePicker.android.tsx:20`, `AdminItemCreatePicker.ios.tsx:11` | Shows admin item create picker. Uses `ScrollView`, `Button`. | android, ios · Compose / RN / SwiftUI | 2 · `src/admin/AdminItemCreateOverlays.android.tsx:24` |
| `AdminItemCreatePrimaryAction` | `src/admin/` `AdminItemCreatePrimaryAction.android.tsx:30`, `AdminItemCreatePrimaryAction.ios.tsx:28` | Renders admin item create primary action content. | android, ios · Compose / SwiftUI | 2 · `src/admin/AdminItemCreateScreen.android.tsx:33` |
| `AdminItemCreateScaffold` | `src/admin/AdminItemCreateScaffold.tsx:7` | Renders admin item create scaffold content. | base | 2 · `src/admin/AdminItemCreateScreen.android.tsx:32` |
| `AdminItemCreateScreen` | `src/admin/` `AdminItemCreateScreen.android.tsx:39`, `AdminItemCreateScreen.ios.tsx:33` | Shows admin item create screen. | android, ios · RN | 2 · `src/brigader/BrigaderItemCreate.android.tsx:26` |
| `AdminItemCreateSourceScene` | `src/admin/AdminItemCreateSourceScene.tsx:53` | Renders admin item create source scene content. | base | 2 · `src/admin/AdminItemCreateScreen.android.tsx:40` |
| `AdminItemDetailBody` | `src/admin/` `AdminItemDetailBody.android.tsx:49`, `AdminItemDetailBody.ios.tsx:50` | Renders admin item detail body content. Uses `ScrollView`, `Button`. | android, ios · Compose / RN / SwiftUI | 2 · `src/admin/AdminItemDetailRead.android.tsx:30` |
| `AdminItemDetailHeader` | `src/admin/` `AdminItemDetailHeader.android.tsx:21`, `AdminItemDetailHeader.ios.tsx:18` | Shows admin item detail header. Uses `Button`. | android, ios · Compose / SwiftUI / RN | 2 · `src/admin/AdminItemDetailBody.android.tsx:40` |
| `AdminItemDetailRead` | `src/admin/` `AdminItemDetailRead.android.tsx:17`, `AdminItemDetailRead.ios.tsx:13` | Renders admin item detail read content. Uses `ScrollView`. | android, ios · Compose / RN / SwiftUI | 2 · `src/brigader/BrigaderItemDetail.android.tsx:17` |
| `AdminItemDetailThumbnail` | `src/admin/AdminItemDetailThumbnail.tsx:15` | Renders admin item detail thumbnail content. | base · RN | 2 · `src/admin/AdminItemDetailHeader.android.tsx:28` |
| `AdminItemDetailTopBar` | `src/admin/` `AdminItemDetailHeader.android.tsx:13`, `AdminItemDetailHeader.ios.tsx:11` | Shows admin item detail top bar. | android, ios · Compose / SwiftUI / RN | 2 · `src/admin/AdminItemDetailRead.android.tsx:23` |
| `AdminItemGroupsRoute` | `src/admin/AdminManagementRoutes.tsx:98` | Renders admin item groups route content. | base · RN | 4 · `src/app/android-admin/item-groups.tsx:5` |
| `AdminLayout` | `src/admin/` `AdminLayout.android.tsx:32`, `AdminLayout.ios.tsx:51` | Admits an authorized Admin session and owns the nested shell navigation. | android, ios · RN | 2 · `src/app/android-admin/_layout.tsx:1` (re-export) |
| `AdminLoadingIndicator` | `src/admin/AdminLoadingIndicator.android.tsx:6` | Renders admin loading indicator content. | android · Compose | 16 · `src/admin/AdminActivityPending.android.tsx:22` |
| `AdminOwnedBackProvider` | `src/admin/AdminOwnedBackContext.tsx:8` | Provides admin owned back state to child views. | base | 2 · `src/admin/AdminOwnedRoutePage.android.tsx:26` |
| `AdminOwnedDock` | `src/admin/` `AdminOwnedDock.android.tsx:7`, `AdminOwnedDock.ios.tsx:7` | Draws the Admin dock for an owned route using RoleBottomBar. | android, ios | 9 · `src/admin/AdminOwnedRoutePage.android.tsx:25` |
| `AdminOwnedNavigationProvider` | `src/admin/AdminOwnedNavigationContext.tsx:13` | Provides admin owned navigation state to child views. | base · RN · Platform.OS | 3 · `src/admin/AdminLayout.android.tsx:27` |
| `AdminOwnedProfileContent` | `src/admin/` `AdminOwnedProfileContent.android.tsx:12`, `AdminOwnedProfileContent.ios.tsx:15` | Renders admin owned profile content content. | android, ios · RN / SwiftUI | 2 · `src/admin/AdminOwnedRouteContent.android.tsx:18` |
| `AdminOwnedRouteContent` | `src/admin/` `AdminOwnedRouteContent.android.tsx:15`, `AdminOwnedRouteContent.ios.tsx:15` | Renders admin owned route content content. | android, ios | 2 · `src/admin/AdminOwnedRoutePage.android.tsx:27` |
| `AdminOwnedRouteNotice` | `src/admin/` `AdminOwnedRouteNotice.android.tsx:8`, `AdminOwnedRouteNotice.ios.tsx:4` | Renders admin owned route notice content. | android, ios · Compose / RN | 2 · `src/admin/AdminOwnedRoutePage.android.tsx:31` |
| `AdminOwnedUsersFallback` | `src/admin/` `AdminOwnedUsersFallback.android.tsx:6`, `AdminOwnedUsersFallback.ios.tsx:6` | Renders admin owned users fallback content. | android, ios | 2 · `src/admin/AdminOwnedRouteContent.android.tsx:23` |
| `AdminPartyCreateScreen` | `src/admin/` `AdminPartyCreateScreen.android.tsx:17`, `AdminPartyCreateScreen.ios.tsx:14` | Shows admin party create screen. Uses `ScrollView`, `Button`. | android, ios · Compose / RN / SwiftUI | 2 · `src/brigader/BrigaderPartyCreateRoute.android.tsx:9` |
| `AdminProfileAction` | `src/admin/AdminProfileAction.tsx:8` | Renders admin profile action content. | base · RN · Platform.OS | 11 · `src/admin/AdminOwnedRoutePage.android.tsx:24` |
| `AdminProfileAvatar` | `src/admin/` `AdminProfileAvatar.android.tsx:15`, `AdminProfileAvatar.ios.tsx:13` | Renders admin profile avatar content. | android, ios · Compose / RN / SwiftUI | 4 · `src/admin/AdminCustomerDetailWithAssignments.android.tsx:9` |
| `AdminProfileAvatarImage` | `src/admin/AdminProfileAvatarImage.tsx:7` | Renders admin profile avatar image content. | base · RN | 3 · `src/admin/AdminProfileAvatar.android.tsx:23` |
| `AdminProfileAvatarPreview` | `src/admin/AdminProfileAvatarPreview.tsx:12` | Shows admin profile avatar preview. Uses `Modal`, `Pressable`. | base · RN | 2 · `src/admin/AdminProfileAvatar.android.tsx:26` |
| `AdminProfileHeader` | `src/admin/AdminProfileHeader.android.tsx:7` | Shows admin profile header. | android · RN | 3 · `src/admin/AdminOwnedProfileContent.android.tsx:15` |
| `AdminProgressQrInfoSectionCard` | `src/admin/` `AdminProgressQrInfoSections.android.tsx:12`, `AdminProgressQrInfoSections.ios.tsx:10` | Shows admin progress qr info section card. | android, ios · Compose / RN / SwiftUI | 2 · `src/admin/AdminProgressQrMaterialSections.android.tsx:6` |
| `AdminQueuePoliciesRoute` | `src/admin/AdminManagementRoutes.tsx:81` | Renders admin queue policies route content. | base · RN | 4 · `src/app/android-admin/queue-policies.tsx:3` |
| `AdminQueuePolicyPanel` | `src/admin/` `AdminQueuePolicyScreen.android.tsx:91`, `AdminQueuePolicyScreen.ios.tsx:44` | Shows admin queue policy panel. | android, ios · Compose / RN / SwiftUI | 4 · `src/brigader/BrigaderApparatusDetail.android.tsx:21` |
| `AdminRootNativeParentSlot` | `src/admin/AdminRootNativeParentContext.tsx:8` | Renders admin root native parent slot content. | base · RN | 3 · `src/admin/AdminRootOwnedSheetCarrier.tsx:39` |
| `AdminRootOwnedSheetCarrier` | `src/admin/AdminRootOwnedSheetCarrier.tsx:46` | Shows admin root owned sheet carrier. | base · RN | 2 · `src/admin/AdminRootPresentation.android.tsx:18` |
| `AdminRootPresentationRootCarrier` | `src/admin/` `AdminRootPresentation.android.tsx:62`, `AdminRootPresentation.ios.tsx:45` | Renders admin root presentation root carrier content. | android, ios · RN | 2 · `src/admin/AdminRootRouter.android.tsx:14` |
| `AdminRootRouterPageProvider` | `src/admin/AdminRootRouterContext.tsx:9` | Provides admin root router page state to child views. | base | 2 · `src/admin/AdminRootRouterScene.android.tsx:20` |
| `AdminScreenHeader` | `src/admin/AdminTopBar.android.tsx:9` | Adapts Admin actions and navigation callbacks to RoleHeader. | android · Compose | 8 · `src/admin/AdditionalSettingsScreen.android.tsx:36` |
| `AdminShellBodyFrame` | `src/admin/AdminShellBodyFrame.tsx:19` | Applies Admin content frame, safe area, padding and dock constraints. | base · RN | 53 · `src/admin/AdditionalSettingsScreen.android.tsx:42` |
| `AdminShellNoticeProvider` | `src/admin/AdminShellNoticeProvider.tsx:20` | Provides admin shell notice state to child views. | base · RN | 4 · `src/admin/AdminLayout.android.tsx:27` |
| `AdminShellProfileAction` | `src/admin/AdminShellProfileAction.tsx:9` | Renders admin shell profile action content. | base · RN · Platform.OS | 16 · `src/admin/AdminActivityRouteCore.tsx:57` |
| `AdminShellProvider` | `src/admin/AdminShellContext.tsx:23` | Provides admin shell state to child views. | base | 2 · `src/admin/AdminLayout.android.tsx:27` |
| `AdminSourceDockScaffold` | `src/admin/AdminSourceDockScaffold.tsx:22` | Coordinates native source viewport/dock layout for owned Admin presentation. | base · RN | 0 static consumers |
| `AdminSupplierDetailScreen` | `src/admin/` `AdminSupplierDetailScreen.android.tsx:120`, `AdminSupplierDetailScreen.ios.tsx:111` | Shows admin supplier detail screen. Uses `ScrollView`. | android, ios · Compose / RN / SwiftUI | 6 · `src/admin/AdminOwnedRouteContent.android.tsx:34` |
| `AdminSupplierItemsScreen` | `src/admin/` `AdminSupplierItemsScreen.android.tsx:65`, `AdminSupplierItemsScreen.ios.tsx:53` | Shows admin supplier items screen. | android, ios · Compose / RN / SwiftUI | 2 · `src/admin/AdminOwnedRouteContent.android.tsx:19` |
| `AdminTestTokenNotice` | `src/admin/AdminTestTokenNotice.tsx:15` | Renders admin test token notice content. | base · RN | 2 · `src/admin/AdminLayout.android.tsx:25` |
| `AdminText` | `src/admin/AdminTypography.android.tsx:29` | Renders admin text content. | android · Compose / RN | 58 · `src/admin/AdminCreateHubHost.android.tsx:25` |
| `AdminTopNoticeContent` | `src/admin/` `AdminTopNoticeContent.android.tsx:13`, `AdminTopNoticeContent.ios.tsx:10` | Renders admin top notice content content. | android, ios · Compose / RN / SwiftUI | 2 · `src/admin/AdminTopNoticeHost.tsx:33` |
| `AdminTopNoticeHost` | `src/admin/AdminTopNoticeHost.tsx:37` | Renders admin top notice host content. | base · RN | 3 · `src/admin/AdminItemCreateScreen.android.tsx:31` |
| `AdminTypographyProvider` | `src/admin/AdminTypography.android.tsx:10` | Provides admin typography state to child views. | android · Compose / RN | 2 · `src/admin/AdminLayout.android.tsx:34` |
| `AdminUserCreateOverlays` | `src/admin/` `AdminUserCreateOverlays.android.tsx:112`, `AdminUserCreateOverlays.ios.tsx:58` | Renders admin user create overlays content. | android, ios · Compose / RN / SwiftUI | 2 · `src/admin/AdminUserCreateScreen.android.tsx:95` |
| `AdminUserCreateScreen` | `src/admin/` `AdminUserCreateScreen.android.tsx:83`, `AdminUserCreateScreen.ios.tsx:68` | Shows admin user create screen. Uses `ScrollView`. | android, ios · Compose / RN / SwiftUI | 4 · `src/brigader/BrigaderCustomerCreateFlow.android.tsx:12` |
| `AdminUsersScreen` | `src/admin/` `AdminUsersScreen.android.tsx:97`, `AdminUsersScreen.ios.tsx:52` | Shows admin users screen. Uses `FlatList`. | android, ios · Compose / RN / SwiftUI | 6 · `src/admin/AdminOwnedUsersFallback.android.tsx:8` |
| `AdminWarehouseCreateDialog` | `src/admin/` `AdminWarehouseCreateDialog.android.tsx:62`, `AdminWarehouseCreateDialog.ios.tsx:41` | Shows admin warehouse create dialog. Uses `Button`. | android, ios · Compose / RN / SwiftUI | 2 · `src/admin/AdminWarehouseMainScreen.android.tsx:178` |
| `AdminWarehouseItemRollsSheet` | `src/admin/` `AdminWarehouseItemRollsSheet.android.tsx:43`, `AdminWarehouseItemRollsSheet.ios.tsx:11` | Shows admin warehouse item rolls sheet. Uses `FlatList`. | android, ios · Compose / RN / SwiftUI | 2 · `src/admin/AdminWarehouseScreen.android.tsx:29` |
| `AdminWarehouseMainScreen` | `src/admin/` `AdminWarehouseMainScreen.android.tsx:152`, `AdminWarehouseMainScreen.ios.tsx:94` | Shows admin warehouse main screen. Uses `ScrollView`. | android, ios · Compose / RN / SwiftUI | 2 · `src/admin/AdminWarehouseScreen.android.tsx:28` |
| `AdminWarehouseRawQrNativeSheet` | `src/admin/` `AdminWarehouseRawQrSheet.android.tsx:15`, `AdminWarehouseRawQrSheet.ios.tsx:13` | Shows admin warehouse raw qr native sheet. Uses `ScrollView`, `Button`. | android, ios · Compose / RN / SwiftUI | 2 · `src/admin/AdminWarehouseScreen.android.tsx:15` |
| `AdminWarehouseRawQrPreview` | `src/admin/AdminWarehouseRawQrPreview.tsx:6` | Shows admin warehouse raw qr preview. | base · RN | 3 · `src/admin/AdminWarehouseRawQrSheet.android.tsx:32` |
| `AdminWarehouseReservedOrderDetails` | `src/admin/` `AdminWarehouseItemRollsOrderDetails.android.tsx:11`, `AdminWarehouseItemRollsOrderDetails.ios.tsx:8` | Renders admin warehouse reserved order details content. | android, ios · Compose / SwiftUI | 2 · `src/admin/AdminWarehouseScreen.android.tsx:24` |
| `AdminWarehouseScreen` | `src/admin/` `AdminWarehouseScreen.android.tsx:19`, `AdminWarehouseScreen.ios.tsx:19` | Shows admin warehouse screen. | android, ios | 2 · `src/brigader/BrigaderWarehouseRoute.android.tsx:10` |
| `AdminWarehouseSettingsTab` | `src/admin/` `AdminWarehouseSettingsTab.android.tsx:69`, `AdminWarehouseSettingsTab.ios.tsx:46` | Shows admin warehouse settings tab. Uses `Button`, `FilterChip`, `Picker`. | android, ios · Compose / RN / SwiftUI | 2 · `src/admin/AdminWarehouseMainScreen.android.tsx:172` |
| `AdminWerkaScreen` | `src/admin/` `AdminWerkaScreen.android.tsx:139`, `AdminWerkaScreen.ios.tsx:118` | Shows admin werka screen. Uses `ScrollView`. | android, ios · Compose / RN / SwiftUI | 4 · `src/admin/AdminOwnedRouteContent.android.tsx:30` |
| `AdminWorkerDetailScreen` | `src/admin/` `AdminWorkerDetailScreen.android.tsx:73`, `AdminWorkerDetailScreen.ios.tsx:87` | Shows admin worker detail screen. Uses `ScrollView`. | android, ios · Compose / RN / SwiftUI | 2 · `src/admin/AdminOwnedRouteContent.android.tsx:37` |
| `AdminWorkerProfileScreen` | `src/admin/` `AdminWorkerProfileScreen.android.tsx:32`, `AdminWorkerProfileScreen.ios.tsx:23` | Shows admin worker profile screen. Uses `ScrollView`, `Button`. | android, ios · Compose / RN / SwiftUI | 2 · `src/admin/AdminOwnedRouteContent.android.tsx:20` |
| `AdminWorkMapApparatusFilter` | `src/admin/` `AdminWorkMapControls.android.tsx:14`, `AdminWorkMapControls.ios.tsx:12` | Renders admin work map apparatus filter content. Uses `FilterChip`. | android, ios · Compose / SwiftUI | 2 · `src/admin/AdminWorkMapRoute.android.tsx:39` |
| `AdminWorkMapAudit` | `src/admin/` `AdminWorkMapAudit.android.tsx:9`, `AdminWorkMapAudit.ios.tsx:8` | Renders admin work map audit content. Uses `ActivityIndicator`. | android, ios · Compose / Expo universal / RN / SwiftUI | 2 · `src/admin/AdminWorkMapRoute.android.tsx:42` |
| `AdminWorkMapAuditCounts` | `src/admin/` `AdminWorkMapAuditCounts.android.tsx:11`, `AdminWorkMapAuditCounts.ios.tsx:11` | Renders admin work map audit counts content. | android, ios · Compose / RN | 2 · `src/admin/AdminWorkMapAudit.android.tsx:23` |
| `AdminWorkMapClosedRow` | `src/admin/` `AdminWorkMapClosedRow.android.tsx:7`, `AdminWorkMapClosedRow.ios.tsx:8` | Shows admin work map closed row. | android, ios · Compose / Expo universal / SwiftUI / RN | 2 · `src/admin/AdminWorkMapRoute.android.tsx:51` |
| `AdminWorkMapCombo` | `src/admin/` `AdminWorkMapCombo.android.tsx:6`, `AdminWorkMapCombo.ios.tsx:6` | Renders admin work map combo content. | android, ios · Compose / Expo universal / SwiftUI | 2 · `src/admin/AdminWorkMapDetail.tsx:61` |
| `AdminWorkMapModules` | `src/admin/` `AdminWorkMapControls.android.tsx:5`, `AdminWorkMapControls.ios.tsx:5` | Renders admin work map modules content. | android, ios · Compose / SwiftUI | 2 · `src/admin/AdminWorkMapRoute.android.tsx:35` |
| `AdminWorkMapMove` | `src/admin/` `AdminWorkMapMove.android.tsx:29`, `AdminWorkMapMove.ios.tsx:27` | Renders admin work map move content. Uses `ActivityIndicator`. | android, ios · Compose / Expo universal / RN / SwiftUI | 2 · `src/admin/AdminWorkMapRoute.android.tsx:36` |
| `AdminWorkMapMoveEmpty` | `src/admin/AdminWorkMapMoveEmpty.tsx:4` | Renders admin work map move empty content. | base · RN | 2 · `src/admin/AdminWorkMapMove.android.tsx:18` |
| `AdminWorkMapMoveHeader` | `src/admin/AdminWorkMapMoveHeader.tsx:7` | Shows admin work map move header. Uses `Pressable`. | base · RN | 2 · `src/admin/AdminWorkMapMove.android.tsx:37` |
| `AdminWorkMapMoveRow` | `src/admin/` `AdminWorkMapMoveRow.android.tsx:8`, `AdminWorkMapMoveRow.ios.tsx:8` | Shows admin work map move row. | android, ios · RN / SwiftUI | 2 · `src/admin/AdminWorkMapMove.android.tsx:21` |
| `AdminWorkMapMoveSplit` | `src/admin/AdminWorkMapMoveSplit.tsx:7` | Renders admin work map move split content. | base · RN | 2 · `src/admin/AdminWorkMapMove.android.tsx:37` |
| `AdminWorkMapPendingRow` | `src/admin/` `AdminWorkMapPendingRow.android.tsx:7`, `AdminWorkMapPendingRow.ios.tsx:9` | Shows admin work map pending row. Uses `Pressable`. | android, ios · RN / SwiftUI / Expo universal | 2 · `src/admin/AdminWorkMapRoute.android.tsx:46` |
| `AdminWorkMapRoute` | `src/admin/` `AdminWorkMapRoute.android.tsx:59`, `AdminWorkMapRoute.ios.tsx:61` | Renders admin work map route content. | android, ios · Expo universal / RN / SwiftUI · Platform.OS | 4 · `src/app/android-brigader/work-map.tsx:3` |
| `AdminWorkMapSequenceRow` | `src/admin/` `AdminWorkMapSequenceRow.android.tsx:9`, `AdminWorkMapSequenceRow.ios.tsx:11` | Shows admin work map sequence row. | android, ios · RN / SwiftUI / Expo universal | 2 · `src/admin/AdminWorkMapRoute.android.tsx:44` |
| `AdminWorkMapSummary` | `src/admin/` `AdminWorkMapSummary.android.tsx:5`, `AdminWorkMapSummary.ios.tsx:5` | Renders work-map aggregate and retry/expansion actions. | android, ios · Compose / Expo universal / SwiftUI | 2 · `src/admin/AdminWorkMapDetail.tsx:62` |
| `AppEntry` | `src/components/AppEntry.tsx:24` | Renders app entry content. Uses `ActivityIndicator`, `Host`, `Button`. | base · Expo universal / RN · Platform.OS | 1 · `src/app/index.tsx:35` |
| `AppSettingsProvider` | `src/components/AppSettings.tsx:12` | Provides app settings state to child views. | base · RN · Platform.OS | 1 · `src/app/_layout.tsx:11` |
| `AppUpdateProvider` | `src/components/AppUpdateProvider.tsx:13` | Provides app update state to child views. | base · RN · Platform.OS | 1 · `src/app/_layout.tsx:11` |
| `AuthBackground` | `src/components/AuthBackground.tsx:4` | Renders auth background content. | base · RN | 3 · `src/LoginScreen.android.tsx:38` |
| `BaseHost` | `src/components/` `BaseHost.android.tsx:6`, `BaseHost.ios.tsx:5`, `BaseHost.tsx:8` | Passes resolved theme and layout direction to the platform Host. | android, ios, base · Compose / SwiftUI / Expo universal / RN | 221 · `src/app/ios-preparation/(home)/_layout.tsx:10` |
| `BoyoqchiContextShell` | `src/boyoqchi/BoyoqchiShell.tsx:5` | Renders boyoqchi context shell content. | base | 2 · `src/boyoqchi/BoyoqchiLayout.android.tsx:22` |
| `BoyoqchiDock` | `src/boyoqchi/BoyoqchiDock.android.tsx:9` | Renders boyoqchi dock content. | android | 3 · `src/app/android-boyoqchi/chat/index.tsx:5` |
| `BoyoqchiImage` | `src/boyoqchi/BoyoqchiImage.tsx:30` | Renders boyoqchi image content. Uses `Pressable`, `Modal`, `ActivityIndicator`. | base · RN | 3 · `src/OrderScreen.tsx:1098` |
| `BoyoqchiMessage` | `src/boyoqchi/BoyoqchiMessage.tsx:6` | Renders boyoqchi message content. | base · RN | 4 · `src/app/android-boyoqchi/profile.tsx:30` |
| `BoyoqchiRequestContent` | `src/boyoqchi/BoyoqchiRequestContent.tsx:19` | Renders boyoqchi request content content. | base · RN | 2 · `src/boyoqchi/BoyoqchiScreen.android.tsx:41` |
| `BoyoqchiScreen` | `src/boyoqchi/` `BoyoqchiScreen.android.tsx:22`, `BoyoqchiScreen.ios.tsx:19` | Shows boyoqchi screen. Uses `ActivityIndicator`. | android, ios · Compose / RN / SwiftUI | 4 · `src/app/android-boyoqchi/astatka.tsx:2` |
| `BrigaderActionIcon` | `src/brigader/` `BrigaderActionIcon.android.tsx:7`, `BrigaderActionIcon.ios.tsx:5` | Renders brigader action icon content. | android, ios · Compose / SwiftUI | 9 · `src/brigader/BrigaderAsyncPicker.tsx:53` |
| `BrigaderApparatusDetail` | `src/brigader/` `BrigaderApparatusDetail.android.tsx:14`, `BrigaderApparatusDetail.ios.tsx:14` | Renders brigader apparatus detail content. Uses `ScrollView`. | android, ios · RN | 2 · `src/brigader/BrigaderApparatusScreen.android.tsx:20` |
| `BrigaderApparatusDock` | `src/brigader/` `BrigaderApparatusDock.android.tsx:6`, `BrigaderApparatusDock.ios.tsx:7` | Renders brigader apparatus dock content. | android, ios | 4 · `src/brigader/BrigaderApparatusPages.android.tsx:25` |
| `BrigaderApparatusPage` | `src/brigader/` `BrigaderApparatusPages.android.tsx:15`, `BrigaderApparatusPages.ios.tsx:15` | Renders brigader apparatus page content. | android, ios · RN · Platform.OS | 10 · `src/app/android-brigader/apparatus-queue.tsx:2` |
| `BrigaderApparatusPrimary` | `src/brigader/` `BrigaderApparatusDock.android.tsx:12`, `BrigaderApparatusDock.ios.tsx:27` | Renders brigader apparatus primary content. | android, ios | 2 · `src/brigader/BrigaderApparatusPages.android.tsx:25` |
| `BrigaderApparatusScreen` | `src/brigader/` `BrigaderApparatusScreen.android.tsx:18`, `BrigaderApparatusScreen.ios.tsx:18` | Shows brigader apparatus screen. | android, ios · RN | 8 · `src/app/android-brigader/apparatus-create.tsx:3` |
| `BrigaderApparatusSurfaces` | `src/brigader/BrigaderApparatusSurfaces.tsx:9` | Renders brigader apparatus surfaces content. Uses `ScrollView`. | base · RN | 4 · `src/brigader/BrigaderApparatusDetail.android.tsx:25` |
| `BrigaderAsyncPicker` | `src/brigader/BrigaderAsyncPicker.tsx:44` | Shows brigader async picker. | base · RN | 2 · `src/brigader/BrigaderCalculateDialogs.tsx:20` |
| `BrigaderBottomBar` | `src/brigader/` `BrigaderBottomBar.android.tsx:17`, `BrigaderBottomBar.ios.tsx:8` | Shows brigader bottom bar. | android, ios · RN | 35 · `src/app/android-brigader/activity.tsx:3` |
| `BrigaderCalculateContent` | `src/brigader/BrigaderCalculateContent.tsx:17` | Renders brigader calculate content content. Uses `ScrollView`. | base · RN | 6 · `src/brigader/BrigaderFlowRoute.android.tsx:23` |
| `BrigaderCalculateMaterialsContent` | `src/brigader/BrigaderCalculateMaterialsContent.tsx:15` | Renders brigader calculate materials content content. Uses `ScrollView`. | base · RN | 6 · `src/brigader/BrigaderFlowRoute.android.tsx:23` |
| `BrigaderCalculateOrdersContent` | `src/brigader/BrigaderCalculateOrdersContent.tsx:15` | Renders brigader calculate orders content content. Uses `FlatList`. | base · RN | 6 · `src/brigader/BrigaderFlowRoute.android.tsx:23` |
| `BrigaderCapacityPanel` | `src/brigader/` `BrigaderCapacityPanel.android.tsx:10`, `BrigaderCapacityPanel.ios.tsx:10` | Shows brigader capacity panel. | android, ios · RN | 4 · `src/brigader/BrigaderApparatusDetail.android.tsx:20` |
| `BrigaderCustomerCreateFlow` | `src/brigader/` `BrigaderCustomerCreateFlow.android.tsx:6`, `BrigaderCustomerCreateFlow.ios.tsx:4` | Renders brigader customer create flow content. | android, ios | 2 · `src/brigader/BrigaderFlowRoute.android.tsx:23` |
| `BrigaderDatePrompt` | `src/brigader/BrigaderDatePrompt.tsx:7` | Renders brigader date prompt content. | base · RN | 3 · `src/brigader/BrigaderCapacityPanel.android.tsx:31` |
| `BrigaderExpandableCard` | `src/brigader/` `BrigaderExpandableCard.android.tsx:10`, `BrigaderExpandableCard.ios.tsx:7` | Shows brigader expandable card. | android, ios · Compose / RN / SwiftUI | 4 · `src/brigader/BrigaderFactoryMapContent.tsx:33` |
| `BrigaderExpandableFilter` | `src/brigader/` `BrigaderExpandableFilter.android.tsx:6`, `BrigaderExpandableFilter.ios.tsx:5` | Renders Brigader expandable option groups on the platform. | android, ios · Compose / SwiftUI | 5 · `src/brigader/BrigaderFactoryMapContent.tsx:37` |
| `BrigaderFactoryMapObjectPicker` | `src/brigader/BrigaderFactoryMapObjectPicker.tsx:8` | Shows brigader factory map object picker. | base · RN | 2 · `src/brigader/BrigaderApparatusDetail.android.tsx:26` |
| `BrigaderFeatureFrame` | `src/brigader/` `BrigaderFeatureFrame.android.tsx:16`, `BrigaderFeatureFrame.ios.tsx:13` | Renders brigader feature frame content. | android, ios · Compose / RN | 21 · `src/brigader/BrigaderApparatusDetail.android.tsx:17` |
| `BrigaderInfoCard` | `src/brigader/` `BrigaderInfoCard.android.tsx:9`, `BrigaderInfoCard.ios.tsx:7` | Shows brigader info card. | android, ios · Compose / RN / SwiftUI | 4 · `src/brigader/BrigaderOpeningWip.android.tsx:21` |
| `BrigaderItemCreate` | `src/brigader/` `BrigaderItemCreate.android.tsx:16`, `BrigaderItemCreate.ios.tsx:14` | Renders brigader item create content. | android, ios | 8 · `src/app/android-brigader/products.tsx:2` |
| `BrigaderItemDetail` | `src/brigader/` `BrigaderItemDetail.android.tsx:8`, `BrigaderItemDetail.ios.tsx:10` | Renders brigader item detail content. | android, ios | 4 · `src/brigader/BrigaderFlowRoute.android.tsx:23` |
| `BrigaderNativePage` | `src/brigader/BrigaderFeedbackProvider.tsx:86` | Renders brigader native page content. | base · RN | 2 · `src/brigader/BrigaderLayout.android.tsx:27` |
| `BrigaderNavigationProvider` | `src/brigader/BrigaderNavigationProvider.tsx:36` | Provides brigader navigation state to child views. | base · RN · Platform.OS | 2 · `src/brigader/BrigaderLayout.android.tsx:27` |
| `BrigaderOpeningWipSurfaces` | `src/brigader/BrigaderOpeningWipSurfaces.tsx:18` | Renders brigader opening wip surfaces content. | base · RN | 2 · `src/brigader/BrigaderOpeningWip.android.tsx:22` |
| `BrigaderOrderConfirmation` | `src/brigader/BrigaderOrderConfirmation.tsx:5` | Renders brigader order confirmation content. | base | 2 · `src/brigader/BrigaderCalculateDialogs.tsx:22` |
| `BrigaderOrderCover` | `src/brigader/BrigaderOrderCover.tsx:15` | Renders brigader order cover content. Uses `Pressable`, `Modal`. | base · RN | 3 · `src/brigader/BrigaderCalculateContent.tsx:21` |
| `BrigaderPaddonPrimary` | `src/brigader/BrigaderPaddonPrimary.tsx:15` | Renders brigader paddon primary content. | base | 2 · `src/brigader/BrigaderApparatusPages.android.tsx:25` |
| `BrigaderPaddons` | `src/brigader/` `BrigaderPaddons.android.tsx:15`, `BrigaderPaddons.ios.tsx:15` | Renders brigader paddons content. Uses `List`. | android, ios · RN | 6 · `src/brigader/BrigaderApparatusPages.android.tsx:23` |
| `BrigaderPartyCreateRoute` | `src/brigader/` `BrigaderPartyCreateRoute.android.tsx:6`, `BrigaderPartyCreateRoute.ios.tsx:6` | Renders brigader party create route content. | android, ios | 4 · `src/app/android-brigader/customer-create.tsx:2` |
| `BrigaderPopupMenu` | `src/brigader/` `BrigaderPopupMenu.android.tsx:7`, `BrigaderPopupMenu.ios.tsx:4` | Shows brigader popup menu. | android, ios · Compose / SwiftUI | 2 · `src/brigader/BrigaderApparatusScreen.android.tsx:27` |
| `BrigaderPresentationHost` | `src/brigader/BrigaderPresentationHost.tsx:13` | Renders brigader presentation host content. | base | 16 · `src/brigader/BrigaderApparatusDetail.android.tsx:26` |
| `BrigaderPrimaryAction` | `src/brigader/BrigaderPrimaryAction.tsx:4` | Renders brigader primary action content. | base | 16 · `src/brigader/BrigaderApparatusDock.android.tsx:8` |
| `BrigaderProductionMapContent` | `src/brigader/BrigaderProductionMapContent.tsx:16` | Renders brigader production map content content. | base · RN | 6 · `src/brigader/BrigaderFlowRoute.android.tsx:23` |
| `BrigaderProgressQr` | `src/brigader/` `BrigaderProgressQr.android.tsx:3`, `BrigaderProgressQr.ios.tsx:3` | Renders brigader progress qr content. | android, ios · Compose / SwiftUI | 4 · `src/brigader/BrigaderFlowRoute.android.tsx:23` |
| `BrigaderProgressQrContent` | `src/brigader/BrigaderProgressQrContent.tsx:38` | Renders brigader progress qr content content. Uses `ScrollView`. | base · RN | 2 · `src/brigader/BrigaderProgressQr.android.tsx:3` |
| `BrigaderQrSection` | `src/brigader/` `BrigaderQrSection.android.tsx:9`, `BrigaderQrSection.ios.tsx:7` | Shows brigader qr section. | android, ios · Compose / RN / SwiftUI | 3 · `src/brigader/BrigaderFactoryMapContent.tsx:37` |
| `BrigaderQuantity` | `src/brigader/` `BrigaderQuantity.android.tsx:3`, `BrigaderQuantity.ios.tsx:4` | Renders brigader quantity content. | android, ios · Compose / SwiftUI | 2 · `src/brigader/BrigaderFactoryMapContent.tsx:33` |
| `BrigaderRawSettingsContent` | `src/brigader/BrigaderRawSettingsContent.tsx:17` | Renders brigader raw settings content content. Uses `FlatList`. | base · RN | 10 · `src/app/android-brigader/raw-material-assignments.tsx:3` |
| `BrigaderSequenceList` | `src/brigader/BrigaderSequenceList.tsx:10` | Drag-reorders the active prefix and preserves read-only fixed rows. | base · RN | 1 · `src/brigader/BrigaderCalculateMaterialsContent.tsx:16` |
| `BrigaderShellProvider` | `src/brigader/BrigaderShellProvider.tsx:12` | Provides brigader shell state to child views. | base | 2 · `src/brigader/BrigaderLayout.android.tsx:26` |
| `BrigaderSurfaceHeader` | `src/brigader/` `BrigaderSurfaceHeader.android.tsx:8`, `BrigaderSurfaceHeader.ios.tsx:6` | Shows brigader surface header. | android, ios · Compose / RN / SwiftUI | 8 · `src/brigader/BrigaderCalculateDialogs.tsx:29` |
| `BrigaderTabs` | `src/brigader/` `BrigaderTabs.android.tsx:9`, `BrigaderTabs.ios.tsx:6` | Shows brigader tabs. | android, ios · Compose / RN / SwiftUI | 5 · `src/brigader/BrigaderOpeningWip.android.tsx:22` |
| `CalculateAction` | `src/brigader/` `BrigaderCalculateNative.android.tsx:21`, `BrigaderCalculateNative.ios.tsx:16` | Renders calculate action content. | android, ios · Compose / SwiftUI | 2 · `src/brigader/BrigaderCalculateContent.tsx:22` |
| `CalculateField` | `src/brigader/` `BrigaderCalculateNative.android.tsx:16`, `BrigaderCalculateNative.ios.tsx:11` | Shows calculate field. | android, ios · Compose / SwiftUI | 3 · `src/brigader/BrigaderCalculateContent.tsx:19` |
| `CalculatePicker` | `src/brigader/` `BrigaderCalculateNative.android.tsx:20`, `BrigaderCalculateNative.ios.tsx:15` | Shows calculate picker. | android, ios · Compose / SwiftUI | 2 · `src/brigader/BrigaderCalculateContent.tsx:21` |
| `CameraSurface` | `src/shared/camera/CameraSurface.tsx:27` | Renders camera surface content. | base · RN | 9 · `src/brigader/BrigaderCameraViewport.tsx:8` |
| `ChatAvatar` | `src/components/ChatAvatar.tsx:10` | Renders chat avatar content. | base · RN · Platform.OS | 5 · `src/components/ChatConversationsScreen.android.tsx:43` |
| `ChatConversationsScreen` | `src/components/` `ChatConversationsScreen.android.tsx:18`, `ChatConversationsScreen.ios.tsx:60`, `ChatConversationsScreen.tsx:5` | Shows chat conversations screen. Uses `Pressable`, `ActivityIndicator`. | android, ios, base · Compose / RN / SwiftUI | 2 · `src/shared/chat/ChatPages.android.tsx:32` |
| `ChatDirectoryPage` | `src/shared/chat/` `ChatPages.android.tsx:34`, `ChatPages.ios.tsx:31` | Renders chat directory page content. | android, ios · Compose / RN | 19 · `src/app/android-admin/chat/new.tsx:1` (re-export) |
| `ChatDirectoryScreen` | `src/components/` `ChatDirectoryScreen.android.tsx:10`, `ChatDirectoryScreen.ios.tsx:40` | Shows chat directory screen. Uses `Host`, `FlatList`, `ActivityIndicator`. | android, ios · Compose / RN / SwiftUI | 2 · `src/shared/chat/ChatPages.android.tsx:36` |
| `ChatListPage` | `src/shared/chat/` `ChatPages.android.tsx:30`, `ChatPages.ios.tsx:27` | Shows chat list page. | android, ios · Compose / RN | 19 · `src/app/android-admin/chat/index.tsx:6` |
| `ChatMediaThumbnail` | `src/components/` `ChatMediaPreview.android.tsx:1`, `ChatMediaPreview.ios.tsx:1`, `ChatMediaPreview.tsx:1` | Public alias for `ChatMediaThumbnail`. | android, ios, base · RN · re-export | 2 · `src/components/ChatThreadScreen.android.tsx:93` |
| `ChatMediaThumbnail` | `src/components/chatMediaPreviewShared.tsx:18` | Renders chat media thumbnail content. | base · RN · Platform.OS | 5 · `src/components/ChatThreadScreen.android.tsx:93` |
| `ChatMetadataProvider` | `src/components/ChatMetadata.tsx:12` | Provides chat metadata state to child views. | base | 1 · `src/shared/chat/ChatRouteContext.tsx:13` |
| `ChatRouteProvider` | `src/shared/chat/ChatRouteContext.tsx:10` | Provides chat route state to child views. | base | 17 · `src/app/android-boyoqchi/chat/_layout.tsx:7` |
| `ChatRouteStack` | `src/shared/chat/` `ChatPages.android.tsx:15`, `ChatPages.ios.tsx:14` | Renders chat route stack content. | android, ios · Compose / RN | 16 · `src/app/android-boyoqchi/chat/_layout.tsx:7` |
| `ChatThreadHeader` | `src/components/ChatThreadHeader.ios.tsx:9` | Shows chat thread header. | ios · RN | 1 · `src/components/ChatThreadScreen.ios.tsx:457` |
| `ChatThreadPage` | `src/shared/chat/` `ChatPages.android.tsx:38`, `ChatPages.ios.tsx:36` | Renders chat thread page content. | android, ios · Compose / RN | 19 · `src/app/android-admin/chat/[conversationId].tsx:1` (re-export) |
| `ChatThreadScreen` | `src/components/` `ChatThreadScreen.android.tsx:17`, `ChatThreadScreen.ios.tsx:418`, `ChatThreadScreen.tsx:7` | Shows chat thread screen. Uses `FlatList`, `Pressable`, `ActivityIndicator`. | android, ios, base · Compose / RN / SwiftUI | 2 · `src/shared/chat/ChatPages.android.tsx:51` |
| `Check` | `src/brigader/BrigaderForm.android.tsx:39` | Renders check content. | android · Compose | 4 · `src/brigader/BrigaderApparatusSurfaces.tsx:14` |
| `ChoiceChips` | `src/brigader/` `BrigaderForm.android.tsx:36`, `BrigaderForm.ios.tsx:24` | Renders selectable form choices with role-owned state. | android, ios · Compose / SwiftUI | 2 · `src/brigader/BrigaderApparatusSurfaces.tsx:20` |
| `Columns` | `src/brigader/` `BrigaderForm.android.tsx:40`, `BrigaderForm.ios.tsx:26` | Renders columns content. | android, ios · Compose / SwiftUI | 3 · `src/brigader/BrigaderCapacityPanel.android.tsx:17` |
| `CorrectionField` | `src/components/DailyWorkCorrectionFields.ios.tsx:10` | Shows correction field. Uses `TextField`. | ios · SwiftUI / RN | 1 · `src/components/WorkerFormField.ios.tsx:8` |
| `CustomerControls` | `src/admin/` `AdminCustomerDetailNative.android.tsx:33`, `AdminCustomerDetailNative.ios.tsx:29` | Renders customer controls content. | android, ios · Compose / RN / SwiftUI | 2 · `src/admin/AdminCustomerDetailScreen.android.tsx:45` |
| `CustomerDeliveryDetailScreen` | `src/customer/` `CustomerDelivery.android.tsx:20`, `CustomerDelivery.ios.tsx:20` | Shows customer delivery detail screen. Uses `Host`, `ScrollView`. | android, ios · Compose / RN / SwiftUI / Expo universal | 2 · `src/customer/CustomerRoutes.android.tsx:57` |
| `CustomerDrawer` | `src/customer/CustomerDrawer.tsx:12` | Shows customer drawer. | base · RN · Platform.OS | 2 · `src/customer/CustomerShell.android.tsx:7` |
| `CustomerEmptyFeedState` | `src/customer/` `CustomerStates.android.tsx:41`, `CustomerStates.ios.tsx:34` | Renders customer empty feed state content. Uses `Host`. | android, ios · Compose / RN / SwiftUI | 2 · `src/customer/CustomerNotificationsView.android.tsx:32` |
| `CustomerEmptyStatusState` | `src/customer/` `CustomerStates.android.tsx:31`, `CustomerStates.ios.tsx:25` | Renders customer empty status state content. Uses `Host`. | android, ios · Compose / RN / SwiftUI | 2 · `src/customer/CustomerHome.android.tsx:84` |
| `CustomerHomeScreen` | `src/customer/` `CustomerHome.android.tsx:33`, `CustomerHome.ios.tsx:16` | Shows customer home screen. Uses `FlatList`, `Pressable`. | android, ios · Compose / RN / SwiftUI / Expo universal | 2 · `src/customer/CustomerRoutes.android.tsx:39` |
| `CustomerIcon` | `src/admin/AdminCustomerDetailNative.android.tsx:17` | Renders customer icon content. | android · Compose / RN | 3 · `src/admin/AdminCustomerDetailScreen.android.tsx:56` |
| `CustomerInfoChip` | `src/admin/` `AdminCustomerDetailNative.android.tsx:73`, `AdminCustomerDetailNative.ios.tsx:67` | Admin customer metadata chip with icon and label. | android, ios · Compose / RN / SwiftUI | 2 · `src/admin/AdminCustomerDetailScreen.android.tsx:37` |
| `CustomerLoadingState` | `src/customer/` `CustomerStates.android.tsx:7`, `CustomerStates.ios.tsx:7` | Renders customer loading state content. Uses `Host`. | android, ios · Compose / RN / SwiftUI | 6 · `src/customer/CustomerDelivery.android.tsx:29` |
| `CustomerNotificationsScreen` | `src/customer/` `CustomerNotificationsView.android.tsx:15`, `CustomerNotificationsView.ios.tsx:17` | Shows customer notifications screen. Uses `FlatList`, `Pressable`. | android, ios · Compose / RN / SwiftUI / Expo universal | 2 · `src/customer/CustomerRoutes.android.tsx:66` |
| `CustomerPrompt` | `src/admin/` `AdminCustomerDetailNative.android.tsx:94`, `AdminCustomerDetailNative.ios.tsx:74` | Renders customer prompt content. | android, ios · Compose / RN / SwiftUI | 3 · `src/admin/AdminCustomerDetailScreen.android.tsx:72` |
| `CustomerRetryState` | `src/customer/` `CustomerStates.android.tsx:16`, `CustomerStates.ios.tsx:12` | Renders customer retry state content. Uses `Host`. | android, ios · Compose / RN / SwiftUI | 6 · `src/customer/CustomerDelivery.android.tsx:30` |
| `CustomerReturnDialog` | `src/customer/` `CustomerReturnDialog.android.tsx:11`, `CustomerReturnDialog.ios.tsx:11` | Shows customer return dialog. | android, ios · Compose / RN / SwiftUI | 2 · `src/customer/CustomerDelivery.android.tsx:89` |
| `CustomerSheetStack` | `src/admin/` `AdminCustomerDetailSheets.android.tsx:75`, `AdminCustomerDetailSheets.ios.tsx:70` | Shows customer sheet stack. | android, ios · Compose / RN / SwiftUI | 2 · `src/admin/AdminCustomerDetailScreen.android.tsx:72` |
| `CustomerSnackbar` | `src/customer/` `CustomerSnackbar.android.tsx:5`, `CustomerSnackbar.ios.tsx:4` | Renders customer snackbar content. Uses `Host`. | android, ios · Compose / RN | 10 · `src/components/WorkerAssignedMaterialQr.tsx:53` |
| `CustomerStatusDetailScreen` | `src/customer/` `CustomerHome.android.tsx:74`, `CustomerHome.ios.tsx:42` | Shows customer status detail screen. Uses `FlatList`. | android, ios · Compose / RN / SwiftUI / Expo universal | 2 · `src/customer/CustomerRoutes.android.tsx:48` |
| `CustomerStatusPanel` | `src/customer/` `CustomerStatusPanel.android.tsx:8`, `CustomerStatusPanel.ios.tsx:15` | Shows customer status panel. Uses `Host`. | android, ios · Compose / RN / SwiftUI | 2 · `src/customer/CustomerHome.android.tsx:41` |
| `DailyWorkCorrectionFields` | `src/components/` `DailyWorkCorrectionFields.ios.tsx:45`, `DailyWorkCorrectionFields.tsx:5` | Renders daily work correction fields content. | ios, base · SwiftUI / RN | 1 · `src/components/DailyWorkDialogs.tsx:38` |
| `DailyWorkDialogs` | `src/components/DailyWorkDialogs.tsx:16` | Renders daily work dialogs content. | base · RN | 3 · `src/components/DailyWorkScreen.android.tsx:188` |
| `DailyWorkScreen` | `src/components/` `DailyWorkScreen.android.tsx:139`, `DailyWorkScreen.ios.tsx:110`, `DailyWorkScreen.tsx:16` | Shows daily work screen. Uses `Pressable`, `FlatList`, `ActivityIndicator`. | android, ios, base · Compose / RN / SwiftUI · Platform.OS | 7 · `src/WorkerScreen.tsx:541` |
| `Dashboard` | `src/gscale/` `GScaleScreen.android.tsx:189`, `GScaleScreen.ios.tsx:114` | Renders dashboard content. Uses `Pressable`, `ScrollView`. | android, ios · Compose / RN / SwiftUI | 2 · `src/material/MaterialReceipt.android.tsx:10` |
| `DecisionIcon` | `src/admin/AdminItemDetailDecisionNative.android.tsx:7` | Renders decision icon content. | android · Compose | 2 · `src/admin/AdminItemDetailCustomerContent.android.tsx:19` |
| `DeviceSheet` | `src/shared/printing/` `DeviceSheet.android.tsx:36`, `DeviceSheet.ios.tsx:10` | Shows device sheet. | android, ios · Compose / RN / SwiftUI | 6 · `src/gscale/GScaleScreen.android.tsx:223` |
| `DropdownFilter` | `src/shared/filters/DropdownFilter.android.tsx:15` | Controlled Compose menu with inline or segmented-card chrome. | android · Compose / Expo universal / RN | 15 · `src/brigader/BrigaderInventoryRoute.android.tsx:73` |
| `FactoryApparatusPicker` | `src/admin/` `FactoryApparatusPicker.android.tsx:17`, `FactoryApparatusPicker.ios.tsx:14` | Shows factory apparatus picker. Uses `Host`, `FlatList`, `Button`. | android, ios · Compose / Expo universal / RN / SwiftUI | 2 · `src/admin/FactoryLocationPickerSheet.android.tsx:19` |
| `FactoryLocationEditorContent` | `src/admin/FactoryLocationEditorContent.tsx:15` | Renders factory location editor content content. Uses `Pressable`. | base · Expo universal / RN | 2 · `src/admin/FactoryLocationsRoute.android.tsx:30` |
| `FactoryLocationPickerSheet` | `src/admin/` `FactoryLocationPickerSheet.android.tsx:7`, `FactoryLocationPickerSheet.ios.tsx:11` | Shows factory location picker sheet. | android, ios · Compose | 2 · `src/admin/FactoryLocationsRoute.android.tsx:34` |
| `FactoryLocationRenameContent` | `src/admin/FactoryLocationRenameContent.tsx:14` | Renders factory location rename content content. | base · Expo universal / RN | 2 · `src/admin/FactoryLocationsRoute.android.tsx:30` |
| `FactoryLocationScreen` | `src/admin/` `FactoryLocationScreen.android.tsx:53`, `FactoryLocationScreen.ios.tsx:46` | Shows factory location screen. Uses `ActivityIndicator`, `FlatList`, `Host`. | android, ios · Compose / RN / SwiftUI | 2 · `src/admin/FactoryLocationsRoute.android.tsx:24` |
| `FeatureBusy` | `src/brigader/` `BrigaderList.android.tsx:20`, `BrigaderList.ios.tsx:20` | Role list busy indicator in a centered inset. | android, ios · Compose / RN / SwiftUI | 19 · `src/brigader/BrigaderApparatusScreen.android.tsx:30` |
| `FeatureError` | `src/brigader/` `BrigaderList.android.tsx:21`, `BrigaderList.ios.tsx:21` | Role list error text and caller-provided retry control. | android, ios · Compose / RN / SwiftUI | 16 · `src/brigader/BrigaderApparatusScreen.android.tsx:30` |
| `FeatureRow` | `src/brigader/` `BrigaderList.android.tsx:11`, `BrigaderList.ios.tsx:9` | Shows feature row. | android, ios · Compose / RN / SwiftUI | 15 · `src/brigader/BrigaderApparatusScreen.android.tsx:28` |
| `Field` | `src/brigader/` `BrigaderForm.android.tsx:12`, `BrigaderForm.ios.tsx:7` | Shows field. | android, ios · Compose / SwiftUI | 11 · `src/brigader/BrigaderApparatusSurfaces.tsx:14` |
| `FieldsRow` | `src/brigader/` `BrigaderForm.android.tsx:41`, `BrigaderForm.ios.tsx:27` | Shows fields row. | android, ios · Compose / SwiftUI | 3 · `src/brigader/BrigaderCalculateContent.tsx:31` |
| `Form` | `src/brigader/` `BrigaderForm.android.tsx:11`, `BrigaderForm.ios.tsx:6` | Renders form content. | android, ios · Compose / SwiftUI | 33 · `src/brigader/BrigaderApparatusDetail.android.tsx:18` |
| `Gap` | `src/brigader/` `BrigaderForm.android.tsx:27`, `BrigaderForm.ios.tsx:15` | Renders gap content. | android, ios · Compose / SwiftUI | 3 · `src/brigader/BrigaderCalculateContent.tsx:22` |
| `GScaleScreen` | `src/gscale/` `GScaleScreen.android.tsx:266`, `GScaleScreen.ios.tsx:182` | Shows g scale screen. Uses `ActivityIndicator`. | android, ios · Compose / RN / SwiftUI · Platform.OS | 2 · `src/app/android-gscale/index.tsx:14` |
| `InlineBusy` | `src/brigader/` `BrigaderForm.android.tsx:26`, `BrigaderForm.ios.tsx:14` | Renders inline busy content. | android, ios · Compose / SwiftUI | 2 · `src/brigader/BrigaderCalculateContent.tsx:21` |
| `InventoryDetailRow` | `src/preparation/PreparationInventoryDetails.android.tsx:26` | Shows inventory detail row. Uses `Host`. | android · Compose | 2 · `src/preparation/PreparationInventoryAssignmentSection.android.tsx:91` |
| `InventorySheetButton` | `src/preparation/PreparationInventoryDetails.android.tsx:46` | Shows inventory sheet button. Uses `Host`. | android · Compose | 5 · `src/preparation/PreparationFormulaEditForm.android.tsx:39` |
| `ItemCreateIcon` | `src/admin/AdminItemCreateNative.android.tsx:4` | Renders item create icon content. | android · Compose | 5 · `src/admin/AdminItemCreateDialogCard.android.tsx:32` |
| `ItemDetailIcon` | `src/admin/AdminItemDetailNative.android.tsx:12` | Renders item detail icon content. | android · Compose | 2 · `src/admin/AdminItemDetailBody.android.tsx:43` |
| `ItemDetailSpinner` | `src/admin/AdminItemDetailNative.android.tsx:15` | Renders item detail spinner content. | android · Compose | 2 · `src/admin/AdminItemDetailBody.android.tsx:55` |
| `ItemGroupsDialogContent` | `src/admin/ItemGroupsDialogContent.tsx:12` | Shows item groups dialog content. Uses `ActivityIndicator`. | base · RN | 2 · `src/admin/ItemGroupsRoute.android.tsx:119` |
| `ItemGroupsPickerSheet` | `src/admin/` `ItemGroupsPickerSheet.android.tsx:7`, `ItemGroupsPickerSheet.ios.tsx:14` | Shows item groups picker sheet. | android, ios · Compose | 2 · `src/admin/ItemGroupsRoute.android.tsx:121` |
| `Label` | `src/brigader/` `BrigaderForm.android.tsx:25`, `BrigaderForm.ios.tsx:13` | Renders label content. | android, ios · Compose / SwiftUI | 29 · `src/brigader/BrigaderApparatusDetail.android.tsx:18` |
| `LoginScreen` | `src/` `LoginScreen.android.tsx:16`, `LoginScreen.ios.tsx:16`, `LoginScreen.tsx:11` | Shows login screen. Uses `Host`, `Button`. | android, ios, base · Compose / RN / SwiftUI / Expo universal · Platform.OS | 2 · `src/app/add-account.tsx:8` |
| `MaterialDevicePicker` | `src/shared/printing/` `MaterialDevicePicker.android.tsx:62`, `MaterialDevicePicker.ios.tsx:44` | Shows material device picker. Uses `ActivityIndicator`, `Host`, `ScrollView`. | android, ios · Compose / RN / SwiftUI | 2 · `src/shared/printing/DeviceSheet.android.tsx:37` |
| `MaterialDrawer` | `src/material/MaterialDrawer.tsx:16` | Shows material drawer. | base · RN · Platform.OS | 2 · `src/material/MaterialLayout.android.tsx:28` |
| `MaterialLinkRequestPanel` | `src/components/WorkerMaterialPanels.tsx:31` | Shows material link request panel. | base · RN | 1 · `src/OrderScreen.tsx:1228` |
| `MaterialManualServer` | `src/shared/printing/MaterialDevicePicker.ios.tsx:19` | Renders material manual server content. Uses `Host`, `List`, `TextField`. | ios · SwiftUI / RN | 0 static consumers |
| `MaterialProvider` | `src/material/MaterialContext.tsx:9` | Provides material state to child views. | base | 2 · `src/material/MaterialLayout.android.tsx:28` |
| `MaterialQuickScanner` | `src/material/` `MaterialQuickScanner.android.tsx:12`, `MaterialQuickScanner.ios.tsx:10` | Renders material quick scanner content. Uses `ActivityIndicator`, `Host`. | android, ios · Compose / RN / SwiftUI | 2 · `src/material/MaterialSequenceAssignment.android.tsx:34` |
| `MaterialTestNotice` | `src/material/MaterialTestNotice.tsx:4` | Renders material test notice content. | base · RN | 2 · `src/material/MaterialLayout.android.tsx:24` |
| `MetalayzerFrame` | `src/metalayzer/MetalayzerFrame.android.tsx:27` | Renders metalayzer frame content. | android · Compose / RN | 3 · `src/metalayzer/MetalayzerHome.android.tsx:20` |
| `MetalayzerHeaderProfile` | `src/metalayzer/MetalayzerHeaderProfile.ios.tsx:6` | Shows metalayzer header profile. | ios | 2 · `src/metalayzer/MetalayzerHome.ios.tsx:28` |
| `MetalayzerScanner` | `src/metalayzer/` `MetalayzerScanner.android.tsx:12`, `MetalayzerScanner.ios.tsx:11` | Renders metalayzer scanner content. | android, ios · Compose / RN / SwiftUI | 2 · `src/metalayzer/MetalayzerHome.android.tsx:50` |
| `MetalayzerSessionGate` | `src/metalayzer/MetalayzerSessionGate.tsx:9` | Renders metalayzer session gate content. Uses `ActivityIndicator`. | base · RN · Platform.OS | 2 · `src/app/android-metalayzer/_layout.tsx:5` |
| `NativeSheetRoute` | `src/app/sheet/[id].tsx:7` | Expo Router presentation route that mounts the registered sheet content. | base | 1 route dispatch · `src/nativeSheet.tsx:130` |
| `NotificationDetailScreen` | `src/shared/notification/` `NotificationDetailScreen.android.tsx:36`, `NotificationDetailScreen.ios.tsx:41` | Shows notification detail screen. Uses `ActivityIndicator`, `Host`, `ScrollView`. | android, ios · Compose / RN / SwiftUI | 0 static consumers |
| `OrderListItem` | `src/shared/orders/` `OrderListItem.android.tsx:11`, `OrderListItem.ios.tsx:28`, `OrderListItem.tsx:9` | Renders a pressable order, image/text and platform-specific queue status. | android, ios, base · RN / SwiftUI / Expo universal | 12 · `src/WorkerScreen.tsx:561` |
| `OrdersHeader` | `src/shared/orders/OrdersHeader.tsx:27` | Composes menu/back, search, clear, profile and auxiliary actions. | base · Expo universal / RN | 32 · `src/admin/AdminWorkMapRoute.android.tsx:32` |
| `OrdersList` | `src/shared/orders/` `OrdersList.android.tsx:12`, `OrdersList.ios.tsx:8`, `OrdersList.tsx:5` | Renders keyed rows, refresh and optional footer content with platform scroll mechanics. | android, ios, base · Compose / RN / SwiftUI / Expo universal | 48 · `src/admin/AdminQueuePolicyScreen.android.tsx:77` |
| `OrdersSearchInput` | `src/shared/orders/` `OrdersSearchInput.android.tsx:7`, `OrdersSearchInput.tsx:6` | Bridges search value and callbacks to the rendered text input. | android, base · Compose / RN / Expo universal | 1 · `src/shared/orders/OrdersHeader.tsx:47` |
| `OrdersWorkspace` | `src/shared/orders/` `OrdersWorkspace.android.tsx:65`, `OrdersWorkspace.ios.tsx:8`, `OrdersWorkspace.tsx:7` | Controls apparatus navigation, active-list content and toolbar integration. | android, ios, base · Compose / RN / SwiftUI / Expo universal | 14 · `src/brigader/BrigaderInventoryRoute.android.tsx:64` |
| `PickerSheetContent` | `src/shared/orders/` `PickerSheetContent.android.tsx:23`, `PickerSheetContent.ios.tsx:18` | Renders labelled searchable picker rows and loading, errors and paging. | android, ios · Compose / Expo universal / RN / SwiftUI | 13 · `src/admin/ItemGroupsPickerSheet.android.tsx:13` |
| `PreparationButton` | `src/preparation/PreparationUI.android.tsx:30` | Labelled Android preparation action. | android · Compose / RN | 9 · `src/preparation/PreparationHome.android.tsx:97` |
| `PreparationDialogs` | `src/preparation/PreparationUI.android.tsx:161` | Renders preparation dialogs content. | android · Compose / RN | 5 · `src/material/MaterialAssignments.android.tsx:27` |
| `PreparationDock` | `src/preparation/PreparationUI.android.tsx:62` | Renders preparation dock content. | android · Compose / RN | 7 · `src/app/android-preparation/chat/index.tsx:6` |
| `PreparationDrawer` | `src/preparation/` `PreparationDrawer.android.tsx:12`, `PreparationDrawer.ios.tsx:12` | Shows preparation drawer. | android, ios | 2 · `src/app/ios-preparation/_layout.tsx:23` |
| `PreparationField` | `src/preparation/PreparationUI.android.tsx:36` | Android preparation input with optional decimal and suffix. | android · Compose / RN | 3 · `src/preparation/PreparationFormulaEditor.android.tsx:56` |
| `PreparationFormulaDetails` | `src/preparation/` `PreparationFormulaDetails.android.tsx:7`, `PreparationFormulaDetails.ios.tsx:7` | Renders preparation formula details content. | android, ios · RN / SwiftUI | 3 · `src/preparation/PreparationFormulaLibrary.android.tsx:164` |
| `PreparationFormulaMenu` | `src/preparation/PreparationFormulaMenu.android.tsx:18` | Shows preparation formula menu. Uses `Pressable`. | android · Compose / RN | 2 · `src/preparation/PreparationFormulaEditor.android.tsx:135` |
| `PreparationHome` | `src/preparation/PreparationHome.ios.tsx:21` | Tayyorlov Masteri iOS home, module list and receipt menu. | ios · SwiftUI / RN | 1 · `src/app/ios-preparation/(home)/index.tsx:1` (re-export) |
| `PreparationHomeScreen` | `src/preparation/PreparationHome.android.tsx:20` | Tayyorlov Masteri Android home, module list and receipt/FAB actions. | android · Compose / RN | 1 · `src/app/android-preparation/index.tsx:1` (re-export) |
| `PreparationInputDialog` | `src/preparation/PreparationInputDialog.ios.tsx:9` | Shows preparation input dialog. Uses `Modal`, `Pressable`, `Host`. | ios · SwiftUI / RN | 4 · `src/preparation/PreparationHome.ios.tsx:69` |
| `PreparationInventoryAssignment` | `src/preparation/` `PreparationInventoryAssignmentSection.android.tsx:18`, `PreparationInventoryAssignmentSection.ios.tsx:10` | Renders preparation inventory assignment content. | android, ios · RN / SwiftUI | 2 · `src/preparation/PreparationMovements.android.tsx:273` |
| `PreparationList` | `src/preparation/PreparationUI.ios.tsx:15` | SwiftUI inset-grouped List with an optional refresh modifier. | ios · SwiftUI / RN | 34 · `src/preparation/PreparationHome.ios.tsx:43` |
| `PreparationNotice` | `src/preparation/PreparationNotice.tsx:5` | Renders preparation notice content. | base · RN | 43 · `src/preparation/PreparationHome.android.tsx:100` |
| `PreparationPage` | `src/preparation/PreparationUI.android.tsx:78` | Android role page header, scroll/refresh, drawer and optional dock/FAB. | android · Compose / RN | 5 · `src/preparation/PreparationHome.android.tsx:82` |
| `PreparationPrinterPicker` | `src/preparation/PreparationPrinterPicker.ios.tsx:9` | Shows preparation printer picker. Uses `Host`, `List`, `ProgressView`. | ios · SwiftUI | 3 · `src/components/useWorkerPrinterSelector.ios.tsx:11` |
| `PreparationProductionNoteDialog` | `src/preparation/` `PreparationProductionNoteDialog.android.tsx:7`, `PreparationProductionNoteDialog.ios.tsx:10` | Shows preparation production note dialog. Uses `Host`. | android, ios · Compose / SwiftUI / RN | 3 · `src/preparation/PreparationProduction.android.tsx:162` |
| `PreparationRow` | `src/preparation/PreparationUI.android.tsx:48` | Android preparation row with title, subtitle and optional actions. | android · Compose / RN | 19 · `src/preparation/PreparationHome.android.tsx:95` |
| `PreparationSeriyoPicker` | `src/preparation/` `PreparationSeriyoPicker.android.tsx:6`, `PreparationSeriyoPicker.ios.tsx:6` | Adapts preparation material data and query paging to shared picker UI. | android, ios | 6 · `src/preparation/PreparationHome.android.tsx:44` |
| `PreparationSharesDialog` | `src/preparation/PreparationSharesDialog.ios.tsx:16` | Shows preparation shares dialog. Uses `Host`, `BottomSheet`, `List`. | ios · SwiftUI / RN | 2 · `src/preparation/PreparationFormula.ios.tsx:127` |
| `PreparationStatus` | `src/preparation/PreparationUI.ios.tsx:18` | Renders preparation busy/error/retry state inside native list sections. | ios · SwiftUI / RN | 7 · `src/preparation/PreparationFormula.ios.tsx:83` |
| `PreparationText` | `src/preparation/PreparationUI.android.tsx:24` | Renders preparation text content. Uses `Host`. | android · Compose / RN | 25 · `src/homashyo/RawSplitDetails.android.tsx:39` |
| `PreparationVariantNameDialog` | `src/preparation/PreparationVariantNameDialog.ios.tsx:9` | Shows preparation variant name dialog. Uses `Modal`, `Pressable`, `Host`. | ios · SwiftUI / RN | 2 · `src/preparation/PreparationLibrary.ios.tsx:63` |
| `PreparationWarehouseCreateDialog` | `src/preparation/` `PreparationWarehouseCreateDialog.android.tsx:8`, `PreparationWarehouseCreateDialog.ios.tsx:8` | Shows preparation warehouse create dialog. Uses `Host`. | android, ios · Compose / RN / SwiftUI | 2 · `src/preparation/PreparationStock.android.tsx:158` |
| `ProfileAvatar` | `src/components/ProfileAvatar.tsx:10` | Renders profile avatar content. | base · RN · Platform.OS | 5 · `src/components/ProfileAvatarPreview.android.tsx:57` |
| `ProfileAvatarPreview` | `src/components/` `ProfileAvatarPreview.android.tsx:23`, `ProfileAvatarPreview.ios.tsx:13` | Shows profile avatar preview. Uses `Pressable`, `Modal`. | android, ios · Compose / RN | 2 · `src/components/ProfileView.android.tsx:73` |
| `ProfileEditor` | `src/components/ProfileEditor.android.tsx:12` | Renders profile editor content. Uses `Button`. | android · Compose | 1 · `src/components/ProfileView.android.tsx:48` |
| `ProfilePressTarget` | `src/components/ProfilePressTarget.ios.tsx:6` | Renders profile press target content. | ios | 2 · `src/components/WorkerHeader.ios.tsx:42` |
| `ProfileScreen` | `src/components/ProfileScreen.tsx:29` | Shows profile screen. | base · RN | 26 · `src/WorkerScreen.tsx:540` |
| `ProfileSettings` | `src/components/` `ProfileSettings.android.tsx:26`, `ProfileSettings.ios.tsx:18`, `ProfileSettings.tsx:14` | Renders profile settings content. Uses `Host`, `Button`. | android, ios, base · Compose / RN / SwiftUI / Expo universal · Platform.OS | 3 · `src/components/ProfileView.android.tsx:60` |
| `ProfileSettingsPreferences` | `src/components/ProfileSettingsPreferences.ios.tsx:9` | Renders profile settings preferences content. Uses `Picker`. | ios · SwiftUI / RN | 1 · `src/components/ProfileView.ios.tsx:172` |
| `ProfileSwitchPin` | `src/components/ProfileSwitchPin.ios.tsx:8` | Renders profile switch pin content. Uses `Button`. | ios · SwiftUI | 1 · `src/components/ProfileView.ios.tsx:172` |
| `ProfileView` | `src/components/` `ProfileView.android.tsx:20`, `ProfileView.ios.tsx:119`, `ProfileView.tsx:27` | Shows profile view. Uses `Host`, `Button`. | android, ios, base · Compose / Expo universal / RN / SwiftUI | 1 · `src/components/ProfileScreen.tsx:181` |
| `QolipCatalogActionMenu` | `src/qolip/QolipCatalogActionMenu.tsx:8` | Shows qolip catalog action menu. Uses `Pressable`. | base · RN | 2 · `src/qolip/QolipProductsScreen.android.tsx:77` |
| `QolipCatalogCodeDetails` | `src/qolip/QolipCatalogCodeDetails.tsx:19` | Renders qolip catalog code details content. Uses `Pressable`. | base · RN | 4 · `src/qolip/QolipProductsScreen.android.tsx:82` |
| `QolipCatalogConfirm` | `src/qolip/` `QolipCatalogConfirm.android.tsx:5`, `QolipCatalogConfirm.ios.tsx:4` | Renders qolip catalog confirm content. Uses `Host`, `Button`. | android, ios · Compose / RN / SwiftUI | 2 · `src/qolip/useQolipCatalogEditors.tsx:214` |
| `QolipDock` | `src/qolip/` `QolipDock.android.tsx:8`, `QolipDock.ios.tsx:2` | Renders qolip dock content. | android, ios | 2 · `src/app/android-qolip/chat/index.tsx:4` |
| `QolipFormSelect` | `src/qolip/` `QolipFormControls.android.tsx:11`, `QolipFormControls.ios.tsx:10` | Renders qolip form select content. | android, ios · Compose / SwiftUI | 2 · `src/qolip/QolipLocationTransferScreenContent.tsx:16` |
| `QolipGridCellPicker` | `src/qolip/` `QolipGridCellPicker.android.tsx:12`, `QolipGridCellPicker.ios.tsx:12` | Shows qolip grid cell picker. Uses `Host`, `ScrollView`, `Button`. | android, ios · Compose / RN / SwiftUI | 2 · `src/qolip/useQolipCellPickerDialog.tsx:12` |
| `QolipHomeBlockBody` | `src/qolip/` `QolipHomeBlockBody.android.tsx:6`, `QolipHomeBlockBody.ios.tsx:6` | Renders qolip home block body content. | android, ios | 4 · `src/qolip/QolipHomeOwner.android.tsx:18` |
| `QolipHomeBlockTabs` | `src/qolip/QolipHomeBlockTabs.tsx:50` | Shows qolip home block tabs. Uses `ScrollView`. | base · RN | 2 · `src/qolip/QolipHomeContent.android.tsx:34` |
| `QolipHomeContent` | `src/qolip/` `QolipHomeContent.android.tsx:14`, `QolipHomeContent.ios.tsx:13` | Renders qolip home content content. Uses `ActivityIndicator`, `Host`. | android, ios · Compose / RN / SwiftUI | 4 · `src/qolip/QolipHomeOwner.android.tsx:11` |
| `QolipHomeGrid` | `src/qolip/` `QolipHomeGrid.android.tsx:58`, `QolipHomeGrid.ios.tsx:53` | Renders qolip home grid content. Uses `ActivityIndicator`, `Host`. | android, ios · Compose / RN / SwiftUI | 2 · `src/qolip/QolipHomeBlockBody.android.tsx:9` |
| `QolipHomePicker` | `src/qolip/` `QolipHomePicker.android.tsx:11`, `QolipHomePicker.ios.tsx:9` | Shows qolip home picker. Uses `Pressable`, `Host`, `ActivityIndicator`. | android, ios · Compose / RN / SwiftUI | 2 · `src/qolip/useQolipHomeActions.tsx:89` |
| `QolipMileageSheet` | `src/qolip/` `QolipMileageSheet.android.tsx:13`, `QolipMileageSheet.ios.tsx:12` | Shows qolip mileage sheet. Uses `Host`, `ActivityIndicator`, `ScrollView`. | android, ios · Compose / RN / SwiftUI | 3 · `src/qolip/QolipReworksScreen.android.tsx:63` |
| `QolipProductTransferContent` | `src/qolip/QolipProductTransferContent.tsx:11` | Renders qolip product transfer content content. Uses `FlatList`, `ActivityIndicator`. | base · RN · Platform.OS | 2 · `src/qolip/QolipProductTransferScreen.android.tsx:3` |
| `QolipQrScannerPreview` | `src/qolip/QolipQrScannerPreview.tsx:12` | Shows qolip qr scanner preview. Uses `ActivityIndicator`. | base · RN | 2 · `src/qolip/QolipQrScanner.android.tsx:36` |
| `QolipQrScannerScreen` | `src/qolip/` `QolipQrScanner.android.tsx:21`, `QolipQrScanner.ios.tsx:19` | Shows qolip qr scanner screen. Uses `Host`, `Button`, `ActivityIndicator`. | android, ios · Compose / RN / SwiftUI | 2 · `src/qolip/useQolipHomeActions.tsx:168` |
| `QolipReadOnlyRetry` | `src/qolip/QolipReadOnlyRetry.tsx:8` | Renders qolip read only retry content. Uses `Host`, `Button`. | base · Expo universal / RN | 3 · `src/qolip/QolipReadOnlyHome.tsx:38` |
| `QolipRoutePage` | `src/qolip/QolipRoutePage.tsx:24` | Renders qolip route page content. | base · RN · Platform.OS | 30 · `src/app/android-qolip/archive-detail.tsx:2` |
| `QolipSequenceOrderDetailContent` | `src/qolip/QolipSequenceOrderDetailContent.tsx:9` | Renders qolip sequence order detail content content. Uses `ScrollView`, `ActivityIndicator`. | base · RN · Platform.OS | 2 · `src/qolip/QolipSequenceOrderDetail.android.tsx:5` |
| `QolipSessionGate` | `src/qolip/QolipSessionGate.tsx:21` | Renders qolip session gate content. Uses `ActivityIndicator`. | base · RN · Platform.OS | 2 · `src/app/android-qolip/_layout.tsx:3` |
| `QolipSetNameDialog` | `src/qolip/` `QolipSetNameDialog.android.tsx:12`, `QolipSetNameDialog.ios.tsx:13` | Shows qolip set name dialog. Uses `Host`. | android, ios · Compose / RN / SwiftUI | 2 · `src/qolip/QolipSetsScreen.android.tsx:47` |
| `QolipStorageExpiredDialog` | `src/qolip/` `QolipStorageConfirm.android.tsx:22`, `QolipStorageConfirm.ios.tsx:21` | Shows qolip storage expired dialog. Uses `Host`. | android, ios · Compose / RN / SwiftUI | 5 · `src/qolip/QolipStorageDateDialog.android.tsx:12` |
| `QolipStorageMoldDetails` | `src/qolip/QolipStorageMoldDetails.tsx:19` | Renders qolip storage mold details content. Uses `ScrollView`. | base · RN | 4 · `src/qolip/QolipArchiveDetailScreenContent.tsx:47` |
| `QolipStorageMoldPicker` | `src/qolip/QolipStorageMoldPickerContent.tsx:29` | Shows qolip storage mold picker. Uses `ActivityIndicator`. | base · RN | 4 · `src/qolip/QolipPaddonScreenContent.tsx:48` |
| `QolipStorageQrDialog` | `src/qolip/` `QolipStorageQrDialog.android.tsx:12`, `QolipStorageQrDialog.ios.tsx:14` | Shows qolip storage qr dialog. Uses `Host`. | android, ios · Compose / RN / SwiftUI | 2 · `src/qolip/QolipArchiveDetailScreenContent.tsx:69` |
| `RawSplitBusy` | `src/homashyo/` `RawSplitBusy.android.tsx:5`, `RawSplitBusy.ios.tsx:4` | Renders raw split busy content. Uses `Host`. | android, ios · Compose / SwiftUI | 4 · `src/homashyo/RawSplitFrame.android.tsx:32` |
| `RawSplitDock` | `src/homashyo/RawSplitDock.android.tsx:9` | Renders raw split dock content. | android | 2 · `src/app/android-homashyo/chat/index.tsx:5` |
| `RawSplitDrawer` | `src/homashyo/RawSplitDrawer.tsx:11` | Shows raw split drawer. | base · RN · Platform.OS | 2 · `src/app/android-homashyo/_layout.tsx:5` |
| `RawSplitFrame` | `src/homashyo/RawSplitFrame.android.tsx:15` | Renders raw split frame content. Uses `Host`. | android · Compose / RN | 3 · `src/homashyo/RawSplitHistoryScreen.android.tsx:15` |
| `RawSplitHeaderProfile` | `src/homashyo/RawSplitHeaderProfile.ios.tsx:6` | Shows raw split header profile. | ios | 2 · `src/homashyo/RawSplitHistoryScreen.ios.tsx:24` |
| `RawSplitHistory` | `src/homashyo/` `RawSplitHistory.android.tsx:14`, `RawSplitHistory.ios.tsx:10` | Renders raw split history content. Uses `ActivityIndicator`. | android, ios · Compose / RN / SwiftUI | 2 · `src/homashyo/RawSplitHistoryScreen.android.tsx:16` |
| `RawSplitHome` | `src/homashyo/` `RawSplitHome.android.tsx:48`, `RawSplitHome.ios.tsx:33` | Renders raw split home content. Uses `ScrollView`, `Host`. | android, ios · Compose / RN / SwiftUI | 2 · `src/homashyo/RawSplitHomeScreen.android.tsx:12` |
| `RawSplitPendingCheck` | `src/homashyo/RawSplitPendingCheck.tsx:9` | Renders raw split pending check content. | base · RN | 2 · `src/homashyo/RawSplitHistoryScreen.android.tsx:16` |
| `RawSplitScanner` | `src/homashyo/RawSplitScanner.tsx:11` | Renders raw split scanner content. | base · RN | 5 · `src/homashyo/RawSplitHomeScreen.android.tsx:13` |
| `RawSplitSessionGate` | `src/homashyo/RawSplitSessionGate.tsx:14` | Renders raw split session gate content. Uses `ActivityIndicator`. | base · RN · Platform.OS | 2 · `src/app/android-homashyo/_layout.tsx:5` |
| `RecentChatPhotosButton` | `src/components/RecentChatPhotos.ios.tsx:49` | Shows recent chat photos button. | ios · SwiftUI / RN | 1 · `src/components/ChatThreadScreen.ios.tsx:376` |
| `RecentChatPhotoStrip` | `src/components/RecentChatPhotos.ios.tsx:237` | Renders recent chat photo strip content. Uses `Pressable`, `Host`. | ios · SwiftUI / RN | 1 · `src/components/ChatThreadScreen.ios.tsx:458` |
| `RezkaItemPicker` | `src/rezka/` `RezkaItemPicker.android.tsx:12`, `RezkaItemPicker.ios.tsx:9` | Shows rezka item picker. Uses `Host`, `ScrollView`, `ActivityIndicator`. | android, ios · Compose / Expo universal / RN / SwiftUI | 2 · `src/rezka/RezkaSplit.android.tsx:59` |
| `RezkaPaddonDetailBody` | `src/rezka/RezkaPaddonDetailBody.tsx:10` | Renders rezka paddon detail body content. Uses `ScrollView`. | base · RN | 2 · `src/rezka/RezkaPaddonDetailReadOnly.android.tsx:20` |
| `RezkaPaddonWipReadOnly` | `src/rezka/` `RezkaPaddonWipReadOnly.android.tsx:12`, `RezkaPaddonWipReadOnly.ios.tsx:12` | Renders rezka paddon wip read only content. Uses `Host`. | android, ios · Compose / RN / SwiftUI | 2 · `src/rezka/RezkaPaddonWipSection.android.tsx:25` |
| `RezkaProfile` | `src/rezka/RezkaProfile.tsx:6` | Renders rezka profile content. | base | 2 · `src/app/ios-rezka/profile.tsx:9` |
| `RezkaScannerPreview` | `src/rezka/RezkaScannerPreview.tsx:11` | Shows rezka scanner preview. | base · RN | 4 · `src/components/WorkerPaddonCamera.tsx:12` |
| `RezkaSessionWaiting` | `src/rezka/RezkaSessionWaiting.tsx:5` | Renders rezka session waiting content. Uses `ActivityIndicator`. | base · RN | 3 · `src/app/ios-rezka/_layout.tsx:24` |
| `RezkaTestSessionUnavailable` | `src/rezka/RezkaTestSessionUnavailable.tsx:5` | Renders rezka test session unavailable content. | base · RN | 3 · `src/app/ios-rezka/_layout.tsx:23` |
| `RezkaWorkerSettingsScreen` | `src/rezka/` `RezkaWorkerSettings.android.tsx:48`, `RezkaWorkerSettings.ios.tsx:39` | Shows rezka worker settings screen. Uses `Host`, `ScrollView`, `ActivityIndicator`. | android, ios · Compose / RN / SwiftUI / Expo universal | 2 · `src/app/ios-rezka/(home)/workers.tsx:9` |
| `RezkaWorkInstructionsScreen` | `src/rezka/` `RezkaWorkInstructions.android.tsx:18`, `RezkaWorkInstructions.ios.tsx:17` | Shows rezka work instructions screen. | android, ios · Compose / RN / SwiftUI | 2 · `src/app/ios-rezka/(home)/instructions.tsx:9` |
| `RoleBottomBar` | `src/shared/navigation/` `RoleBottomBar.android.tsx:38`, `RoleBottomBar.ios.tsx:11` | Renders active role destinations, badge state and platform-specific insets. | android, ios · Compose / RN / SwiftUI | 17 · `src/admin/AdminBottomBar.android.tsx:43` |
| `RoleDrawer` | `src/shared/navigation/` `RoleDrawer.android.tsx:15`, `RoleDrawer.ios.tsx:28` | Wraps a screen in a role-aware drawer with guarded selection and footer action. | android, ios · Compose / Expo universal / RN / SwiftUI | 15 · `src/app/ios-rezka/_layout.tsx:40` |
| `RoleDrawerButton` | `src/shared/navigation/RoleDrawerButton.ios.tsx:5` | Shows role drawer button. Uses `Host`, `Button`. | ios · SwiftUI | 11 · `src/app/ios-boyoqchi/(tabs)/(astatka)/_layout.tsx:6` |
| `RoleFab` | `src/shared/navigation/` `RoleFab.android.tsx:53`, `RoleFab.ios.tsx:13` | Presents role action choices and delegates selections through the caller guard. | android, ios · Compose / RN | 8 · `src/components/WorkerFab.android.tsx:13` |
| `RoleHeader` | `src/shared/navigation/RoleHeader.android.tsx:10` | Android standard role header with title, subtitle and navigation/action slots. | android · Compose | 31 · `src/app/android-boyoqchi/profile.tsx:29` |
| `RoleHeaderButton` | `src/shared/navigation/RoleHeaderButton.tsx:21` | Accessible menu/back icon button aligned to role header metrics. | base · RN | 35 · `src/admin/AdditionalSettingsScreen.ios.tsx:46` |
| `RoleHeaderRow` | `src/shared/navigation/RoleHeaderRow.tsx:7` | Lays out the controls around the role search field. | base · RN | 6 · `src/admin/AdminItemCreateHeader.android.tsx:40` |
| `RoleHeaderSearchField` | `src/shared/navigation/RoleHeaderRow.tsx:11` | Owns the shape and leading icon of the search pill. | base · RN | 4 · `src/admin/AdminItemCreateHeader.android.tsx:43` |
| `RoleProfileButton` | `src/shared/navigation/RoleHeaderButton.tsx:9` | Press or hold the profile affordance, with an accessibility label. | base · RN · Platform.OS | 2 · `src/admin/AdminProfileAction.tsx:13` |
| `RoleTabs` | `src/shared/navigation/RoleTabs.ios.tsx:17` | Builds the iOS router-owned native tab bar for persistent role destinations. | ios | 11 · `src/app/ios-boyoqchi/(tabs)/_layout.tsx:8` |
| `RoleTopBar` | `src/shared/navigation/RoleTopBar.android.tsx:7` | Shows role top bar. | android · Compose | 15 · `src/admin/AdminCustomerDetailScreen.android.tsx:56` |
| `Select` | `src/brigader/` `BrigaderForm.android.tsx:29`, `BrigaderForm.ios.tsx:17` | Renders select content. | android, ios · Compose / SwiftUI | 8 · `src/brigader/BrigaderApparatusSurfaces.tsx:17` |
| `SelectedChatMediaPreview` | `src/components/` `ChatMediaPreview.android.tsx:1`, `ChatMediaPreview.ios.tsx:1`, `ChatMediaPreview.tsx:1` | Public alias for `SelectedChatMediaPreview`. | android, ios, base · RN · re-export | 2 · `src/components/ChatThreadScreen.android.tsx:122` |
| `SelectedChatMediaPreview` | `src/components/chatMediaPreviewShared.tsx:10` | Shows selected chat media preview. | base · RN · Platform.OS | 5 · `src/components/ChatThreadScreen.android.tsx:122` |
| `StandaloneChatLayout` | `src/shared/chat/` `ChatPages.android.tsx:56`, `ChatPages.ios.tsx:54` | Shows standalone chat layout. Uses `ActivityIndicator`. | android, ios · Compose / RN | 2 · `src/app/android-chat/_layout.tsx:2` |
| `StorageList` | `src/qolip/` `QolipStorageNative.android.tsx:45`, `QolipStorageNative.ios.tsx:43` | Shows storage list. Uses `FlatList`, `Host`, `ActivityIndicator`. | android, ios · Compose / RN / SwiftUI | 4 · `src/qolip/QolipArchiveDetailScreenContent.tsx:57` |
| `SupplierDrawer` | `src/supplier/SupplierShell.tsx:38` | Shows supplier drawer. | base · RN | 2 · `src/supplier/SupplierPages.android.tsx:52` |
| `SupplierHomeScreen` | `src/supplier/` `SupplierOverviewScreens.android.tsx:31`, `SupplierOverviewScreens.ios.tsx:32` | Shows supplier home screen. | android, ios · Compose / RN / SwiftUI | 2 · `src/supplier/SupplierPages.android.tsx:52` |
| `SupplierRecentScreen` | `src/supplier/` `SupplierOverviewScreens.android.tsx:50`, `SupplierOverviewScreens.ios.tsx:55` | Shows supplier recent screen. | android, ios · Compose / RN / SwiftUI | 2 · `src/supplier/SupplierPages.android.tsx:58` |
| `SupplierShell` | `src/supplier/SupplierShell.tsx:16` | Renders supplier shell content. Uses `ActivityIndicator`. | base · RN · Platform.OS | 2 · `src/app/android-supplier/_layout.tsx:4` |
| `SupplierStatusBreakdownScreen` | `src/supplier/` `SupplierOverviewScreens.android.tsx:67`, `SupplierOverviewScreens.ios.tsx:75` | Shows supplier status breakdown screen. | android, ios · Compose / RN / SwiftUI | 2 · `src/supplier/SupplierPages.android.tsx:64` |
| `SupplierStatusDetailScreen` | `src/supplier/` `SupplierOverviewScreens.android.tsx:105`, `SupplierOverviewScreens.ios.tsx:118` | Shows supplier status detail screen. | android, ios · Compose / RN / SwiftUI | 2 · `src/supplier/SupplierPages.android.tsx:74` |
| `SupplierSubmittedCategoryDetailScreen` | `src/supplier/` `SupplierOverviewScreens.android.tsx:89`, `SupplierOverviewScreens.ios.tsx:100` | Shows supplier submitted category detail screen. | android, ios · Compose / RN / SwiftUI | 2 · `src/supplier/SupplierPages.android.tsx:70` |
| `Toggle` | `src/brigader/` `BrigaderForm.android.tsx:24`, `BrigaderForm.ios.tsx:12` | Renders toggle content. | android, ios · Compose / SwiftUI | 7 · `src/brigader/BrigaderApparatusDetail.android.tsx:19` |
| `UserCreateIcon` | `src/admin/AdminUserCreateNative.android.tsx:9` | Renders user create icon content. | android · Compose / RN | 3 · `src/admin/AdminPartyCreateScreen.android.tsx:22` |
| `UserCreateSelectable` | `src/admin/AdminUserCreateNative.android.tsx:13` | Renders user create selectable content. | android · Compose / RN | 2 · `src/admin/AdminUserCreateOverlays.android.tsx:28` |
| `WelcomeLayout` | `src/components/WelcomeLayout.tsx:12` | Shows welcome layout. Uses `ScrollView`. | base · RN | 2 · `src/components/WelcomeScreen.android.tsx:12` |
| `WelcomeScreen` | `src/components/` `WelcomeScreen.android.tsx:10`, `WelcomeScreen.ios.tsx:9` | Shows welcome screen. Uses `Host`, `Button`. | android, ios · Compose / RN / SwiftUI | 1 · `src/components/AppEntry.tsx:112` |
| `WerkaArchiveListDateFilter` | `src/werka/` `WerkaArchiveListDateFilter.android.tsx:10`, `WerkaArchiveListDateFilter.ios.tsx:7` | Shows werka archive list date filter. Uses `Host`, `Button`. | android, ios · Compose / RN / SwiftUI | 2 · `src/werka/WerkaArchiveListContent.android.tsx:17` |
| `WerkaArchivePdfActionSheet` | `src/werka/` `WerkaArchivePdfActionSheet.android.tsx:8`, `WerkaArchivePdfActionSheet.ios.tsx:7` | Presents share/save PDF actions for the Werka archive. | android, ios · Compose / Expo universal / SwiftUI | 0 static consumers |
| `WerkaArchivePeriodGrid` | `src/werka/` `WerkaArchivePeriodGrid.android.tsx:7`, `WerkaArchivePeriodGrid.ios.tsx:6` | Renders werka archive period grid content. Uses `Button`. | android, ios · Compose / SwiftUI | 4 · `src/werka/WerkaArchivePeriodContent.android.tsx:18` |
| `WerkaBatchQuantityField` | `src/werka/WerkaBatchQuantityField.tsx:5` | Shows werka batch quantity field. Uses `Host`. | base · Expo universal / RN | 2 · `src/werka/WerkaBatchDraftContent.android.tsx:33` |
| `WerkaReceiveFooter` | `src/werka/` `WerkaReceiveFooter.android.tsx:10`, `WerkaReceiveFooter.ios.tsx:7` | Renders werka receive footer content. Uses `ActivityIndicator`. | android, ios · Compose / RN / SwiftUI | 4 · `src/werka/WerkaPaddonFooter.android.tsx:6` |
| `WorkerActivePaddonButton` | `src/components/` `WorkerActivePaddon.android.tsx:11`, `WorkerActivePaddon.ios.tsx:9` | Shows worker active paddon button. | android, ios · Compose / RN / SwiftUI | 2 · `src/components/WorkerCutControls.tsx:33` |
| `WorkerActivePaddonButton` | `src/components/WorkerActivePaddon.tsx:1` | Public alias for `WorkerActivePaddonButton`. | base · Compose / RN · re-export | 1 · `src/components/WorkerCutControls.tsx:33` |
| `WorkerActivePaddonPicker` | `src/components/` `WorkerActivePaddon.android.tsx:34`, `WorkerActivePaddon.ios.tsx:19` | Shows worker active paddon picker. | android, ios · Compose / RN / SwiftUI | 2 · `src/components/WorkerCutControls.tsx:41` |
| `WorkerActivePaddonPicker` | `src/components/WorkerActivePaddon.tsx:1` | Public alias for `WorkerActivePaddonPicker`. | base · Compose / RN · re-export | 1 · `src/components/WorkerCutControls.tsx:41` |
| `WorkerAlert` | `src/components/` `WorkerAlert.android.tsx:5`, `WorkerAlert.ios.tsx:5`, `WorkerAlert.tsx:6` | Displays a short native alert or confirmation from declarative alert data. | android, ios, base · Compose / RN / SwiftUI / Expo universal | 23 · `src/WorkerScreen.tsx:608` |
| `WorkerAssignedMaterialQr` | `src/components/WorkerAssignedMaterialQr.tsx:19` | Renders worker assigned material qr content. Uses `ScrollView`. | base · RN | 3 · `src/OrderScreen.tsx:1036` |
| `WorkerBottomBar` | `src/components/` `WorkerBottomBar.android.tsx:11`, `WorkerBottomBar.tsx:12` | Shows worker bottom bar. | android, base · Expo universal / RN | 4 · `src/WorkerScreen.tsx:593` |
| `WorkerCutControls` | `src/components/WorkerCutControls.tsx:18` | Renders worker cut controls content. | base | 1 · `src/WorkerScreen.tsx:536` |
| `WorkerCutSheets` | `src/components/WorkerCutControls.tsx:38` | Renders worker cut sheets content. | base | 1 · `src/WorkerScreen.tsx:609` |
| `WorkerCutToolbar` | `src/components/` `WorkerCutToolbar.ios.tsx:3`, `WorkerCutToolbar.tsx:3` | Renders worker cut toolbar content. | ios, base · SwiftUI / RN | 1 · `src/components/WorkerCutControls.tsx:30` |
| `WorkerCutToolbarActions` | `src/components/WorkerCutControls.tsx:28` | Renders worker cut toolbar actions content. | base | 1 · `src/WorkerScreen.tsx:527` |
| `WorkerDailyPage` | `src/components/WorkerDailyPage.tsx:13` | Renders worker daily page content. | base · RN | 1 · `src/WorkerScreen.tsx:330` |
| `WorkerDeliveryDialog` | `src/components/` `WorkerDeliveryDialog.android.tsx:7`, `WorkerDeliveryDialog.tsx:8` | Shows worker delivery dialog. Uses `Host`. | android, base · Compose / RN | 1 · `src/OrderScreen.tsx:1357` |
| `WorkerDetailIcon` | `src/admin/AdminWorkerDetailNative.android.tsx:16` | Renders worker detail icon content. | android · Compose | 3 · `src/admin/AdminWorkerDetailEditors.android.tsx:15` |
| `WorkerDetailOverlays` | `src/admin/` `AdminWorkerDetailOverlays.android.tsx:80`, `AdminWorkerDetailOverlays.ios.tsx:74` | Renders worker detail overlays content. Uses `Picker`. | android, ios · Compose / RN / SwiftUI | 4 · `src/admin/AdminCustomerMaterialWarehouseEditor.android.tsx:27` |
| `WorkerDrawer` | `src/components/` `WorkerDrawer.android.tsx:7`, `WorkerDrawer.ios.tsx:9`, `WorkerDrawer.tsx:29` | Builds Worker destinations and delegates the drawer surface to RoleDrawer. | android, ios, base · Expo universal / RN | 4 · `src/WorkerScreen.tsx:620` |
| `WorkerExpansion` | `src/components/` `WorkerExpansion.android.tsx:8`, `WorkerExpansion.ios.tsx:8`, `WorkerExpansion.tsx:7` | Disclosure header controlled by expanded state and a caller-owned toggle. | android, ios, base · Compose / SwiftUI / RN | 5 · `src/OrderScreen.tsx:1204` |
| `WorkerExpoGoCameraPreview` | `src/components/WorkerExpoGoCameraPreview.tsx:77` | Shows worker expo go camera preview. | base · RN | 1 · `src/OrderScreen.tsx:1165` |
| `WorkerFab` | `src/components/` `WorkerFab.android.tsx:11`, `WorkerFab.ios.tsx:14`, `WorkerFab.tsx:13` | Renders worker fab content. | android, ios, base · RN / Expo universal | 1 · `src/WorkerScreen.tsx:595` |
| `WorkerFormDialog` | `src/components/` `WorkerFormDialog.android.tsx:7`, `WorkerFormDialog.ios.tsx:11`, `WorkerFormDialog.tsx:6` | Presents a form with confirm/cancel, scroll bounds and dismissal rules. | android, ios, base · Compose / RN / SwiftUI / Expo universal | 13 · `src/OrderScreen.tsx:1133` |
| `WorkerFormField` | `src/components/` `WorkerFormField.ios.tsx:6`, `WorkerFormField.tsx:7` | Shows worker form field. | ios, base · Expo universal / RN | 9 · `src/components/DailyWorkCorrectionFields.tsx:8` |
| `WorkerFramePrint` | `src/components/` `WorkerFramePrint.android.tsx:5`, `WorkerFramePrint.ios.tsx:6` | Renders worker frame print content. Uses `Host`. | android, ios · Compose / SwiftUI | 1 · `src/components/WorkerRezkaOutputReport.tsx:192` |
| `WorkerHeader` | `src/components/WorkerHeader.ios.tsx:16` | Shows worker header. Uses `Host`, `Button`. | ios · Expo universal / RN | 0 static consumers |
| `WorkerHeader` | `src/components/WorkerHeader.tsx:1` | Public alias for `OrdersHeader`. | base · Expo universal / RN · re-export | 0 static consumers |
| `WorkerHistoryButton` | `src/components/WorkerHistoryButton.ios.tsx:7` | Shows worker history button. Uses `Button`. | ios · SwiftUI / RN | 2 · `src/components/WorkerOrderIdentity.ios.tsx:28` |
| `WorkerIconButton` | `src/components/` `WorkerIconButton.android.tsx:7`, `WorkerIconButton.ios.tsx:7`, `WorkerIconButton.tsx:6` | Selects a platform icon-only action surface and exposes a text label. | android, ios, base · Compose / RN / SwiftUI | 23 · `src/OrderScreen.tsx:1120` |
| `WorkerInitialOrderSwitch` | `src/components/WorkerInitialOrderSwitch.tsx:24` | Renders worker initial order switch content. | base | 1 · `src/OrderScreen.tsx:1278` |
| `WorkerInputProgress` | `src/components/` `WorkerInputProgress.android.tsx:11`, `WorkerInputProgress.ios.tsx:10` | Renders worker input progress content. | android, ios · Compose / RN / SwiftUI | 1 · `src/OrderScreen.tsx:1244` |
| `WorkerInventoryScanner` | `src/components/WorkerInventoryScanner.tsx:10` | Renders worker inventory scanner content. | base · RN | 3 · `src/brigader/BrigaderInventoryRoute.android.tsx:76` |
| `WorkerInventoryScreen` | `src/components/` `WorkerInventoryScreen.android.tsx:17`, `WorkerInventoryScreen.ios.tsx:14` | Shows worker inventory screen. | android, ios · Compose / RN / SwiftUI | 4 · `src/WorkerScreen.tsx:540` |
| `WorkerInventorySheet` | `src/components/WorkerInventorySheet.tsx:16` | Shows worker inventory sheet. | base · RN | 3 · `src/brigader/BrigaderInventoryRoute.android.tsx:96` |
| `WorkerLaminationReport` | `src/components/WorkerLaminationReport.tsx:51` | Renders worker lamination report content. Uses `ActivityIndicator`. | base · RN · Platform.OS | 1 · `src/OrderScreen.tsx:1330` |
| `WorkerLongPressActions` | `src/components/WorkerLongPressActions.tsx:39` | Renders worker long press actions content. Uses `Host`, `Button`. | base · Expo universal / RN · Platform.OS | 1 · `src/WorkerScreen.tsx:467` |
| `WorkerMaterialList` | `src/components/` `WorkerMaterialList.android.tsx:7`, `WorkerMaterialList.ios.tsx:7` | Shows worker material list. | android, ios · Compose / SwiftUI | 3 · `src/OrderScreen.tsx:1210` |
| `WorkerMaterialResponsibilities` | `src/admin/` `AdminWorkerDetailEditors.android.tsx:26`, `AdminWorkerDetailEditors.ios.tsx:23` | Renders worker material responsibilities content. | android, ios · Compose / SwiftUI | 2 · `src/admin/AdminWorkerDetailScreen.android.tsx:102` |
| `WorkerMaterialRollPicker` | `src/components/` `WorkerMaterialRollPicker.android.tsx:6`, `WorkerMaterialRollPicker.ios.tsx:7` | Shows worker material roll picker. Uses `Host`, `Button`. | android, ios · Compose / SwiftUI | 1 · `src/components/useWorkerMaterialPanels.tsx:81` |
| `WorkerMaterialUsePanel` | `src/components/WorkerMaterialPanels.tsx:11` | Shows worker material use panel. | base · RN | 1 · `src/OrderScreen.tsx:1230` |
| `WorkerOrderActionGroup` | `src/components/` `WorkerOrderControls.android.tsx:17`, `WorkerOrderControls.ios.tsx:42` | Renders worker order action group content. | android, ios · Compose / RN / SwiftUI | 1 · `src/OrderScreen.tsx:1258` |
| `WorkerOrderAlertButton` | `src/components/WorkerOrderAlertButton.tsx:12` | Shows worker order alert button. | base · RN | 1 · `src/OrderScreen.tsx:1224` |
| `WorkerOrderBlockingNotice` | `src/components/` `WorkerOrderControls.android.tsx:8`, `WorkerOrderControls.ios.tsx:12` | Renders worker order blocking notice content. | android, ios · Compose / RN / SwiftUI | 1 · `src/OrderScreen.tsx:1201` |
| `WorkerOrderButton` | `src/components/WorkerOrderControls.android.tsx:6` | Public alias for `WorkerSheetButton`. | android · Expo universal / RN · re-export | 12 · `src/OrderScreen.tsx:107` |
| `WorkerOrderButton` | `src/components/WorkerOrderControls.ios.tsx:25` | Shows worker order button. Uses `Host`, `Button`. | ios · SwiftUI / RN | 10 · `src/OrderScreen.tsx:107` |
| `WorkerOrderDetails` | `src/components/WorkerOrderDetails.tsx:23` | Renders worker order details content. Uses `ScrollView`, `Host`, `Button`. | base · Expo universal / RN | 1 · `src/WorkerScreen.tsx:193` |
| `WorkerOrderFreezeDetails` | `src/components/WorkerOrderDetails.tsx:100` | Renders worker order freeze details content. Uses `Host`. | base · Expo universal / RN | 2 · `src/WorkerScreen.tsx:254` |
| `WorkerOrderHeader` | `src/components/WorkerOrderHeader.tsx:13` | Shows worker order header. Uses `Pressable`. | base · RN | 6 · `src/OrderScreen.tsx:1178` |
| `WorkerOrderIdentity` | `src/components/WorkerOrderIdentity.android.tsx:1` | Public alias for `WorkerOrderHeader`. | android · RN · re-export | 1 · `src/OrderScreen.tsx:1178` |
| `WorkerOrderIdentity` | `src/components/WorkerOrderIdentity.ios.tsx:13` | Renders worker order identity content. Uses `Host`, `Button`. | ios · SwiftUI / RN | 1 · `src/OrderScreen.tsx:1178` |
| `WorkerOrderImage` | `src/components/WorkerOrderHeader.tsx:33` | Renders worker order image content. | base · RN | 9 · `src/OrderScreen.tsx:1155` |
| `WorkerOrderListItem` | `src/components/` `WorkerOrderListItem.android.tsx:1`, `WorkerOrderListItem.ios.tsx:1`, `WorkerOrderListItem.tsx:1` | Public alias for `OrderListItem`. | android, ios, base · RN / SwiftUI / Expo universal · re-export | 1 · `src/WorkerScreen.tsx:561` |
| `WorkerOrderMergeDialog` | `src/components/WorkerOrderMergeDialog.tsx:9` | Shows worker order merge dialog. | base · RN | 1 · `src/OrderScreen.tsx:1289` |
| `WorkerOrderOverview` | `src/components/` `WorkerOrderOverview.android.tsx:13`, `WorkerOrderOverview.ios.tsx:11`, `WorkerOrderOverview.tsx:7` | Renders worker order overview content. Uses `Host`. | android, ios, base · Compose / Expo universal / RN / SwiftUI | 5 · `src/OrderScreen.tsx:1270` |
| `WorkerOrderPauseStatus` | `src/components/` `WorkerOrderPauseStatus.android.tsx:4`, `WorkerOrderPauseStatus.tsx:3` | Renders worker order pause status content. | android, base · Compose / RN | 1 · `src/OrderScreen.tsx:1196` |
| `WorkerOrderSheet` | `src/components/` `WorkerOrderSheet.android.tsx:11`, `WorkerOrderSheet.ios.tsx:13`, `WorkerOrderSheet.tsx:9` | Hosts a native bottom sheet with dismissal, size and scroll policy. | android, ios, base · Compose / RN / SwiftUI | 24 · `src/WorkerScreen.tsx:596` |
| `WorkerOrderSyncProgress` | `src/components/WorkerOrderSyncProgress.tsx:5` | Renders worker order sync progress content. | base · RN | 2 · `src/OrderScreen.tsx:1195` |
| `WorkerOrderThumbnail` | `src/components/WorkerOrderThumbnail.tsx:10` | Renders worker order thumbnail content. | base · RN | 16 · `src/brigader/BrigaderFactoryOrderDetail.tsx:31` |
| `WorkerOutputProgress` | `src/components/` `WorkerOutputProgress.android.tsx:5`, `WorkerOutputProgress.ios.tsx:6`, `WorkerOutputProgress.tsx:11` | Renders worker output progress content. Uses `Host`. | android, ios, base · Compose / SwiftUI | 1 · `src/OrderScreen.tsx:1256` |
| `WorkerPaddonCamera` | `src/components/WorkerPaddonCamera.tsx:7` | Renders worker paddon camera content. | base · RN | 2 · `src/components/WorkerPaddonDetail.android.tsx:65` |
| `WorkerPaddonDetail` | `src/components/` `WorkerPaddonDetail.android.tsx:16`, `WorkerPaddonDetail.ios.tsx:19` | Renders worker paddon detail content. Uses `FlatList`, `Host`, `ActivityIndicator`. | android, ios · Compose / RN / SwiftUI | 5 · `src/app/ios-worker/(home)/paddon/[code].tsx:8` |
| `WorkerPaddonDialog` | `src/components/` `WorkerPaddonDialog.android.tsx:7`, `WorkerPaddonDialog.ios.tsx:46` | Shows worker paddon dialog. Uses `Host`, `ScrollView`. | android, ios · Compose / RN / SwiftUI | 7 · `src/components/WorkerPaddonDetail.android.tsx:95` |
| `WorkerPaddonDraggable` | `src/components/useWorkerPaddonDrag.tsx:40` | Renders worker paddon draggable content. Uses `Pressable`. | base · RN | 2 · `src/components/WorkerPaddonTransfer.android.tsx:33` |
| `WorkerPaddonFeedback` | `src/components/` `WorkerPaddonFeedback.ios.tsx:10`, `WorkerPaddonFeedback.tsx:7` | Renders worker paddon feedback content. | ios, base · SwiftUI / RN / Expo universal | 8 · `src/components/DailyWorkDialogs.tsx:41` |
| `WorkerPaddonList` | `src/components/` `WorkerPaddonList.android.tsx:16`, `WorkerPaddonList.ios.tsx:14` | Shows worker paddon list. Uses `ActivityIndicator`, `Host`, `FlatList`. | android, ios · Compose / RN / SwiftUI | 2 · `src/components/WorkerPaddons.android.tsx:13` |
| `WorkerPaddonPage` | `src/components/WorkerPaddonPage.tsx:9` | Renders worker paddon page content. | base | 1 · `src/WorkerScreen.tsx:364` |
| `WorkerPaddonPicker` | `src/components/` `WorkerPaddonPicker.android.tsx:7`, `WorkerPaddonPicker.ios.tsx:6` | Shows worker paddon picker. Uses `ScrollView`, `Host`. | android, ios · Compose / RN / SwiftUI | 1 · `src/components/useWorkerPaddonPresentation.tsx:36` |
| `WorkerPaddons` | `src/components/` `WorkerPaddons.android.tsx:9`, `WorkerPaddons.ios.tsx:6` | Renders worker paddons content. | android, ios · RN | 3 · `src/WorkerScreen.tsx:540` |
| `WorkerPaddonTransfer` | `src/components/` `WorkerPaddonTransfer.android.tsx:14`, `WorkerPaddonTransfer.ios.tsx:17` | Two-area source/target pallet transfer workflow scoped to a Worker apparatus. | android, ios · Compose / RN / SwiftUI | 4 · `src/app/ios-worker/(home)/paddon-transfer.tsx:8` |
| `WorkerPaddonWipCard` | `src/components/` `WorkerPaddonWip.android.tsx:17`, `WorkerPaddonWip.ios.tsx:18` | Shows worker paddon wip card. Uses `Host`. | android, ios · Compose / SwiftUI | 4 · `src/components/WorkerPaddonDetail.android.tsx:70` |
| `WorkerPaddonWipContent` | `src/components/` `WorkerPaddonWip.android.tsx:6`, `WorkerPaddonWip.ios.tsx:7` | Renders worker paddon wip content content. | android, ios · Compose / SwiftUI | 1 · `src/components/WorkerPaddonDetail.ios.tsx:96` |
| `WorkerPaintPalette` | `src/components/` `WorkerPaintPalette.android.tsx:18`, `WorkerPaintPalette.ios.tsx:19`, `WorkerPaintPalette.tsx:7` | Renders worker paint palette content. Uses `Host`, `Button`. | android, ios, base · Compose / SwiftUI / Expo universal | 1 · `src/OrderScreen.tsx:1105` |
| `WorkerPeremotkaButton` | `src/components/` `WorkerPeremotka.android.tsx:10`, `WorkerPeremotka.ios.tsx:8` | Shows worker peremotka button. | android, ios · Compose / RN / SwiftUI | 2 · `src/components/WorkerCutControls.tsx:31` |
| `WorkerPeremotkaButton` | `src/components/WorkerPeremotka.tsx:1` | Public alias for `WorkerPeremotkaButton`. | base · Compose / RN · re-export | 1 · `src/components/WorkerCutControls.tsx:31` |
| `WorkerPeremotkaSheet` | `src/components/` `WorkerPeremotka.android.tsx:17`, `WorkerPeremotka.ios.tsx:12` | Shows worker peremotka sheet. | android, ios · Compose / RN / SwiftUI | 2 · `src/components/WorkerCutControls.tsx:42` |
| `WorkerPeremotkaSheet` | `src/components/WorkerPeremotka.tsx:1` | Public alias for `WorkerPeremotkaSheet`. | base · Compose / RN · re-export | 1 · `src/components/WorkerCutControls.tsx:42` |
| `WorkerPreflightButton` | `src/components/` `WorkerPreflightButton.ios.tsx:3`, `WorkerPreflightButton.tsx:3` | Shows worker preflight button. | ios, base | 1 · `src/OrderScreen.tsx:1251` |
| `WorkerProfileButton` | `src/components/WorkerProfileButton.ios.tsx:15` | Shows worker profile button. | ios · SwiftUI / RN | 6 · `src/app/ios-preparation/(home)/_layout.tsx:10` |
| `WorkerProgressField` | `src/components/WorkerProgressField.android.tsx:7` | Shows worker progress field. | android · Compose | 0 static consumers |
| `WorkerProgressField` | `src/components/WorkerProgressField.tsx:1` | Public alias for `WorkerFormField`. | base · Expo universal / RN · re-export | 0 static consumers |
| `WorkerQrScanner` | `src/components/WorkerQrScanner.tsx:4` | Renders worker qr scanner content. | base | 1 · `src/WorkerScreen.tsx:611` |
| `WorkerQrScannerDialogs` | `src/components/WorkerQrScannerDialogs.tsx:6` | Renders worker qr scanner dialogs content. | base | 2 · `src/components/WorkerQrScannerView.android.tsx:55` |
| `WorkerQrScannerPreview` | `src/components/WorkerQrScannerPreview.tsx:9` | Shows worker qr scanner preview. Uses `ActivityIndicator`. | base · RN | 2 · `src/components/WorkerQrScannerView.android.tsx:41` |
| `WorkerQrScannerView` | `src/components/` `WorkerQrScannerView.android.tsx:13`, `WorkerQrScannerView.ios.tsx:11` | Shows worker qr scanner view. Uses `ScrollView`, `Button`. | android, ios · Compose / RN / SwiftUI | 3 · `src/components/WorkerQrScanner.tsx:6` |
| `WorkerQueueCard` | `src/components/WorkerQueueCard.android.tsx:10` | Android segmented card frame for interactive result rows. | android · RN | 62 · `src/admin/AdminActivityScreen.android.tsx:23` |
| `WorkerQueueConnectionProgress` | `src/components/` `WorkerQueueConnectionProgress.android.tsx:6`, `WorkerQueueConnectionProgress.ios.tsx:5` | Shows a delayed indicator while the queue is loading or reconnecting. | android, ios · RN / SwiftUI | 1 · `src/WorkerScreen.tsx:584` |
| `WorkerQueueFilter` | `src/components/` `WorkerQueueFilter.android.tsx:7`, `WorkerQueueFilter.ios.tsx:6`, `WorkerQueueFilter.tsx:5` | Selects the session-scoped queue size for the Worker window. | android, ios, base · Expo universal | 1 · `src/WorkerScreen.tsx:579` |
| `WorkerQueueList` | `src/components/` `WorkerQueueList.android.tsx:7`, `WorkerQueueList.ios.tsx:6`, `WorkerQueueList.tsx:6` | Adapts the order queue to the shared OrdersList. | android, ios, base | 1 · `src/components/WorkerSearchQueueList.tsx:48` |
| `WorkerRadioChoice` | `src/components/` `WorkerRadioChoice.ios.tsx:5`, `WorkerRadioChoice.tsx:6` | Renders worker radio choice content. Uses `Host`, `Button`. | ios, base · SwiftUI / RN | 2 · `src/components/WorkerDeliveryDialog.tsx:16` |
| `WorkerReportField` | `src/components/` `WorkerReportField.android.tsx:7`, `WorkerReportField.ios.tsx:7` | Controlled form field bridging focus and text to native input. | android, ios · Compose / Expo universal / SwiftUI | 3 · `src/components/WorkerRezkaOutputReport.tsx:153` |
| `WorkerReturnedPaintField` | `src/components/WorkerReturnedPaintField.ios.tsx:13` | Shows worker returned paint field. Uses `TextField`. | ios · SwiftUI / RN | 1 · `src/OrderScreen.tsx:1107` |
| `WorkerReturnedPaintField` | `src/components/WorkerReturnedPaintField.tsx:1` | Public alias for `Field`. | base · Expo universal / RN · re-export | 1 · `src/OrderScreen.tsx:1107` |
| `WorkerRezkaAstatkaReport` | `src/components/WorkerRezkaAstatkaReport.tsx:35` | Renders worker rezka astatka report content. Uses `ActivityIndicator`. | base · RN · Platform.OS | 1 · `src/OrderScreen.tsx:1341` |
| `WorkerRezkaOutputReport` | `src/components/WorkerRezkaOutputReport.tsx:75` | Renders worker rezka output report content. Uses `ActivityIndicator`. | base · RN · Platform.OS | 1 · `src/OrderScreen.tsx:1316` |
| `WorkerScannedWipHistory` | `src/components/` `WorkerScannedWipHistory.android.tsx:12`, `WorkerScannedWipHistory.ios.tsx:19` | Renders worker scanned wip history content. Uses `Button`. | android, ios · Compose / Expo universal / RN / SwiftUI | 1 · `src/OrderScreen.tsx:1351` |
| `WorkerScreen` | `src/WorkerScreen.tsx:63` | Apparatus order queue, filters, search, recent results and order/action presentation. | base · Expo universal / RN · Platform.OS | 6 · `src/app/index.tsx:47` |
| `WorkerSearchHeader` | `src/components/WorkerSearchHeader.tsx:8` | Binds raw Worker search text to OrdersHeader without rerendering the root queue. | base | 1 · `src/WorkerScreen.tsx:532` |
| `WorkerSearchQueueList` | `src/components/WorkerSearchQueueList.tsx:26` | Previews matches from in-memory rows until the correct server window catches up. | base | 1 · `src/WorkerScreen.tsx:550` |
| `WorkerSecurityProvider` | `src/components/WorkerSecurity.tsx:31` | Provides worker security state to child views. | base · RN | 23 · `src/app/index.tsx:46` |
| `WorkerSheetButton` | `src/components/WorkerSheetButton.tsx:22` | Full-width labelled CTA for Worker and reused sheet surfaces. | base · Expo universal / RN | 67 · `src/OrderScreen.tsx:107` |
| `WorkerSwitchPrompt` | `src/components/` `WorkerSwitchPrompt.android.tsx:11`, `WorkerSwitchPrompt.ios.tsx:10` | Renders worker switch prompt content. Uses `Button`. | android, ios · Compose / RN / SwiftUI | 1 · `src/components/WorkerInitialOrderSwitch.tsx:82` |
| `WorkerTabs` | `src/components/` `WorkerTabs.android.tsx:4`, `WorkerTabs.ios.tsx:4`, `WorkerTabs.tsx:4` | Builds apparatus and Completed tabs for the platform OrdersWorkspace. | android, ios, base | 1 · `src/WorkerScreen.tsx:542` |
| `WorkerWarehouseEditor` | `src/admin/` `AdminWorkerDetailEditors.android.tsx:9`, `AdminWorkerDetailEditors.ios.tsx:7` | Renders worker warehouse editor content. | android, ios · Compose / SwiftUI | 2 · `src/admin/AdminWorkerDetailScreen.android.tsx:56` |
| `WorkerWipBatchDetails` | `src/components/WorkerWipBatchDetails.tsx:23` | Renders worker wip batch details content. | base · RN | 3 · `src/components/DailyWorkDialogs.tsx:28` |
| `WorkerWipBatchDetailsView` | `src/components/` `WorkerWipBatchDetailsView.android.tsx:12`, `WorkerWipBatchDetailsView.ios.tsx:10`, `WorkerWipBatchDetailsView.tsx:9` | Shows worker wip batch details view. Uses `ScrollView`, `Host`, `Button`. | android, ios, base · Compose / RN / SwiftUI / Expo universal | 1 · `src/components/WorkerWipBatchDetails.tsx:66` |
| `WorkerWipHistory` | `src/components/WorkerWipHistory.tsx:87` | Renders worker wip history content. Uses `ActivityIndicator`, `Host`, `Button`. | base · Expo universal / RN · Platform.OS | 4 · `src/WorkerScreen.tsx:259` |
| `WorkerWipHistorySheet` | `src/components/WorkerWipHistory.tsx:34` | Shows worker wip history sheet. | base · Expo universal / RN · Platform.OS | 1 · `src/WorkerScreen.tsx:599` |
| `WorkerWorkInstructions` | `src/components/` `WorkerWorkInstructions.android.tsx:8`, `WorkerWorkInstructions.ios.tsx:6` | Renders worker work instructions content. | android, ios · RN | 4 · `src/WorkerScreen.tsx:540` |
| `WorkInstructionsView` | `src/rezka/` `RezkaWorkInstructions.android.tsx:22`, `RezkaWorkInstructions.ios.tsx:21` | Shows work instructions view. Uses `ActivityIndicator`, `Host`, `ScrollView`. | android, ios · Compose / RN / SwiftUI | 2 · `src/components/WorkerWorkInstructions.android.tsx:14` |

## A2. Detail cards

The TypeScript definitions show essential props or, for the inline module list, the inferred item shape. Each JSX excerpt is from the cited source. Measurements use the app's logical units. Native styles use their library and OS defaults wherever the call site leaves a value unset.

#### Request-backed order lists

```ts
type OrdersListProps<T> = {
  children: ReactNode; rows?: readonly T[]; footer?: ReactNode;
  renderRow?: (row: T, index: number) => ReactNode;
  rowKey?: (row: T, index: number) => string;
  onRefresh?: () => Promise<void>; onEndReached?: () => void;
  active: boolean; topInset: number;
  headerOffset: SharedValue<number>; headerHeight: SharedValue<number>;
};
```

`src/components/WorkerSearchQueueList.tsx:48`

```tsx
return <WorkerQueueList {...props} active={active} rows={visibleRows} rowKey={rowKey} renderRow={renderVisibleRow}>
  {children}
  {!preview && !loading && !visibleRows.length ? emptyState : null}
</WorkerQueueList>;
```

- **Android** Animated FlatList uses the supplied top inset, an end threshold of 0.5, a nine-window render window and nested scrolling. Queue pages add 48 to the measured header. `src/shared/orders/OrdersList.android.tsx:97` and `src/WorkerScreen.tsx:550`.

- **iOS** SwiftUI plain List uses native ForEach with a hidden background and soft top scroll edge. Insets and row heights come from List and the row implementation. `src/shared/orders/OrdersList.ios.tsx:8`.

- **Behavior** Caller supplies refresh and row identity. Android uses RefreshControl and exposes end reach and keyboard tap policy. iOS uses refreshable. iOS paging belongs to callers through an appearing final row or a more button. Worker gates previews and empty states separately from refresh. `src/shared/orders/PickerSheetContent.ios.tsx:39` and `src/components/WorkerSearchQueueList.tsx:44`.

#### Queue filter and option menu

```ts
type WorkerQueueFilterProps = {
  value: QueueLimit; enabled: boolean; loading?: boolean;
  backgroundColor: ColorValue; onChange: (value: QueueLimit) => void;
  machinePicker?: ReactNode;
  labels?: { title: string; all: string; counts: Record<number, string> };
};
```

`src/WorkerScreen.tsx:579`

```tsx
<WorkerQueueFilter key="queue-filter" machinePicker={machinePicker} labels={workerQueueLimitLabels(locale, QUEUE_LIMITS)} value={queueLimit} enabled={limitReady} loading={!!queue && loading && loadedScope !== windowScope} backgroundColor={colors.surface} onChange={limit => {
  if (limit === queueLimit) return;
  setQueueLimit(limit);
  void saveQueueLimit(session, limit).catch(() => {});
}} />
```

- **Android** WorkerQueueFilter adapts DropdownFilter. The grouped row uses the Worker card tokens and gap 8. Custom long-press menu items have minimum 112×48 and 12/8 padding. `src/components/WorkerQueueFilter.android.tsx:7` and `src/shared/filters/DropdownFilter.android.tsx:24`.

- **iOS** Borderless picker row with 4 spacing and 4 vertical padding. The apparatus menu is a slot supplied by OrdersWorkspace. `src/components/WorkerQueueFilter.ios.tsx:6`.

- **Behavior** Choice is controlled by the screen. Android collapses after selecting and preserves the enabled gate. iOS uses native selection. Values 5, 10, 20, 50 and 0 (All) are persisted by origin, role and profile ref. The Worker loading prop at the call site is advisory and does not paint a spinner inside these filter implementations. `src/workerQueueLimit.ts:5` and `src/WorkerScreen.tsx:579`.

#### Apparatus tabs containing lists

```ts
type OrdersWorkspaceProps = {
  session: Session; tabs: readonly { id: string; name: string }[];
  selected: string; onSelect: (id: string) => void; loading?: boolean;
  header?: ReactNode; headerOffset?: SharedValue<number>;
  children: (id: string, pagerGesture?: PanGesture, machinePicker?: ReactNode) => ReactNode;
};
```

`src/components/WorkerTabs.android.tsx:4`

```tsx
export function WorkerTabs(props: WorkerTabsProps) {
  return <OrdersWorkspace {...props} tabs={getWorkerTabs(props.machines, props.completedLabel)} />;
}
```

- **Android** 48-high strip and 3-high rounded indicator. Two tabs distribute evenly and the distribution option uses a 90 minimum width. Tap animates over 200 ms and horizontal swipes settle with a spring. `src/shared/orders/OrdersWorkspace.android.tsx:89`, `src/shared/orders/OrdersWorkspace.android.tsx:111` and `src/shared/orders/OrdersWorkspace.android.tsx:244`.

- **iOS** Apparatus is a SwiftUI menu Picker with 60 minimum width, truncated label and native toolbar/search chrome. `src/shared/orders/OrdersWorkspace.ios.tsx:12`.

- **Behavior** Android mounts keyed pages after measuring the pager and keeps them mounted while tab IDs are stable. Its RN FlatList virtualizes rows, defers thumbnails and coordinates inactive scroll offsets with the header. iOS renders the selected child. Durable per-tab search or scroll is a caller responsibility on iOS. Android tabs expose selected accessibility state. `src/shared/orders/OrdersWorkspace.android.tsx:33` and `src/shared/orders/OrdersWorkspace.ios.tsx:32`.

#### Order bottom sheet

```ts
type WorkerOrderSheetProps = {
  children: ReactNode; onClose: () => void;
  dismissible?: boolean; preventDismiss?: boolean;
  compact?: boolean; fitContent?: boolean; measureContent?: boolean;
  heightFraction?: number;
};
```

`src/WorkerScreen.tsx:596`

```tsx
{activeOrder ? <WorkerOrderSheet key={activeOrder.presentationId} onClose={activeOrder.onClose!}>
  {renderOrderRoute(activeOrder, activeOrder.onClose!, queue)}
</WorkerOrderSheet> : null}
```

`src/app/sheet/[id].tsx:18`

```tsx
return <SecurityContext.Provider value={sheet.security}>
  <WorkerOrderSheet onClose={close} compact={sheet.options.compact} fitContent={sheet.options.fitContent} dismissible={sheet.options.dismissible} heightFraction={sheet.options.heightFraction}>
    {sheet.content}
  </WorkerOrderSheet>
</SecurityContext.Provider>;
```

- **Android** An Expo Router transparent-modal host wraps a Compose ModalBottomSheet and skips partial expansion. The measured content target is 86% of usable height for full and 65% for compact. It includes a bottom safe-area inset. `src/components/WorkerOrderSheet.android.tsx:15` and `src/app/_layout.tsx:25`.

- **iOS** SwiftUI BottomSheet defaults to a 90% full detent. Compact fixed mode uses 50% and 90% or the requested fraction. A 100% override uses large. Measured compact mode bounds the content based on screen space with a 180 minimum target and uses 16 top padding if dismissible. `src/components/WorkerOrderSheet.ios.tsx:14` and `src/components/WorkerOrderSheet.ios.tsx:46`.

- **Behavior** Worker tap rejects frozen orders, keeps read-only detail available where applicable and prevents competing sheets. Android closes via the route registry and iOS retires the presentation ID. Both supply close context. Compact content has RN scrolling and retains keyboard taps. Gestures and back/outside dismissal follow platform flags. `src/WorkerScreen.tsx:206` and `src/components/workerSheetContext.ts:1`.

#### Icon and sheet buttons

```ts
type WorkerIconButtonProps = {
  icon: 'close' | 'edit' | 'check' | 'back' | 'photo' | 'scannedWips';
  label: string; onPress: () => void; tonal?: boolean; size?: number;
};
type WorkerSheetButtonProps = {
  label: string; onPress: () => void; disabled?: boolean;
  variant?: 'text' | 'filled' | 'outlined'; height?: number; largeLabel?: boolean;
};
```

`src/OrderScreen.tsx:1126`

```tsx
<WorkerIconButton icon="photo" size={48} label={t(paintPhoto ? 'Rasmni almashtirish' : 'Rasm qo‘shish')}
  onPress={() => { if (!photoBusy) pickPaintImage(); }} />
```

- **Android** WorkerIconButton defaults to 40×40 with 20 icons, using 24 icons at size 48 or larger. The fallback round surface uses radius size/2. WorkerSheetButton is full width with optional height. Its large label is 22/600 and optional symbol is 20. `src/components/WorkerIconButton.android.tsx:7` and `src/components/WorkerSheetButton.tsx:22`.

- **iOS** WorkerIconButton uses fixed or minimum 44-point targets in the native branches, with glass where available. The Android implementation consumes the size prop. The universal sheet button uses its own height and label options. `src/components/WorkerIconButton.ios.tsx:7`.

- **Behavior** Icon buttons take explicit accessibility labels. Sheet buttons use disabled state and a labelled variant, leaving business authority in the caller. FAB actions have a different contract under RoleFab. `src/shared/navigation/RoleFab.android.tsx:89`.

#### Search top bar

```ts
type OrdersHeaderProps = {
  search: string; onSearchChange: (value: string) => void;
  searchPlaceholder?: string; onMenu?: () => void; onBack?: () => void;
  onProfile?: () => void; enabled?: boolean; actions?: ReactNode;
};
type WorkerSearchHeaderInput = { input: WorkerSearchInput };
```

`src/WorkerScreen.tsx:532`

```tsx
<WorkerSearchHeader key={readScope} input={searchInput} onMenu={openDrawer} onProfile={() => selectDestination('profile')}
  actions={Platform.OS === 'android' ? cutActions : undefined} />
```

`src/shared/orders/OrdersWorkspace.ios.tsx:27`

```tsx
<Toolbar modifiers={[
  navigationTitle(title), navigationBarTitleDisplayMode('large'),
  searchable(query, { placement: 'navigationBarDrawer', prompt: searchPlaceholder, onChange: onSearchChange }),
  textInputAutocapitalization('never'),
]}>
```

- **Android** RoleHeaderRow is 70 minimum. Padding is 10 horizontal and 6 vertical with gap 6. The search capsule is 56 minimum with radius 30. Clear target is 44×48. `src/shared/navigation/roleNavigationMetrics.ts:1`, `src/shared/navigation/RoleHeaderRow.tsx:21` and `src/shared/orders/OrdersHeader.tsx:65`.

- **iOS** Worker home uses the SwiftUI large navigation title and native searchable in the navigationBarDrawer. The OS supplies field typography and dimensions. OrdersHeader also runs on some iOS Admin pages as a separate pattern. `src/shared/orders/OrdersWorkspace.ios.tsx:26` and `src/admin/AdminWorkMapRoute.ios.tsx:34`.

- **Behavior** WorkerSearchHeader subscribes to raw edits, while the shared query controller publishes after 350 ms. The field has separate focus, clear and close behavior. Native setters coordinate the JS draft with the field, and search inputs disable autocorrect and capitalization where configured. OrdersHeader requires either menu or back as a discriminated prop. `src/components/WorkerSearchHeader.tsx:8`, `src/shared/orders/OrdersHeader.tsx:22` and `src/workerSearchInput.ts:30`.

#### Drawer

```ts
type RoleDrawerProps = {
  visible: boolean; onOpen: () => void; onClose: () => void;
  title: string; items: readonly RoleDrawerItem[]; active?: string;
  onSelect: (id: string) => void;
  closeAccessibilityLabel: string; children: ReactNode;
  footerAction?: RoleDrawerItem & { destructive?: boolean };
};
```

`src/components/WorkerDrawer.android.tsx:15`

```tsx
return <RoleDrawer {...props} title={t('Bo‘limlar')} items={workerDrawerItems(displayName, canTransfer, paddons, t, showDailyWork)} onSelect={select}
  closeAccessibilityLabel={t('Menyuni yopish')}
  footerAction={{ id: 'logout', label: t('Chiqish'), symbol: 'rectangle.portrait.and.arrow.right', destructive: true }} />;
```

- **Android** Front drawer width is the lesser of configured/default 320 and window width minus 56. Right corners are 16, title is 16/700, safe top gets 12 and footer button height is 56. `src/shared/navigation/RoleDrawer.android.tsx:27` and `src/shared/navigation/RoleDrawer.android.tsx:56`.

- **iOS** Back drawer width is min(360, 82% of screen). Rows use minimum 54 with 20 horizontal inset and dynamic body text. Heading uses title2 semibold. Edge swipe is configurable. `src/shared/navigation/RoleDrawer.ios.tsx:39`.

- **Behavior** Both wrap react-native-drawer-layout and expose overlay close labels. Disabled items stay inert and selecting the active destination only closes. Android intercepts hardware Back while open. Worker supplies dynamic pallet/daily/transfer entries and the logout confirmation. `src/shared/navigation/roleDrawerModel.ts:28` and `src/components/WorkerDrawer.android.tsx:7`.

#### Tayyorlov Masteri module list

```ts
type PreparationHomeProps = Record<string, never>;
type PreparationModuleItem = { title: string; onPress: () => void };
type PreparationListProps = { children: ReactNode; refresh?: () => Promise<void> };
```

`src/preparation/PreparationHome.android.tsx:84`

```tsx
<Column verticalArrangement={{ spacedBy: 2 }} modifiers={[fillMaxWidth()]}>
  {menuItems.map((item, index) => <ListItem key={item.title} colors={{ containerColor: colors.surface }} modifiers={[
    fillMaxWidth(),
    clip(Shapes.RoundedCorner({ topStart: index === 0 ? 16 : 4, topEnd: index === 0 ? 16 : 4,
      bottomStart: index === menuItems.length - 1 ? 16 : 4, bottomEnd: index === menuItems.length - 1 ? 16 : 4 })),
    clickable(item.onPress),
  ]}>
    <ListItem.HeadlineContent><Text style={{ typography: 'bodyLarge', fontWeight: '500' }}>{t(item.title)}</Text></ListItem.HeadlineContent>
  </ListItem>)}
</Column>
```

`src/preparation/PreparationHome.ios.tsx:44`

```tsx
<Section>
  <Button label={t('Ombor')} systemImage="building.2" onPress={() => router.push('/ios-preparation/warehouse' as Href)} />
  <Button label={t('Homashyolar')} systemImage="shippingbox" onPress={() => router.push('/ios-preparation/materials' as Href)} />
  <Button label={t('Mahsulot formulasi')} systemImage="list.bullet.rectangle" onPress={() => router.push('/ios-preparation/sets' as Href)} />
  <Button label={t('Buyurtmalar')} systemImage="list.number" onPress={() => router.push('/ios-preparation/sequence' as Href)} />
  <Button label={t('Ishlab chiqarish')} systemImage="chart.bar" onPress={() => router.replace('/ios-preparation/production' as Href)} />
  <Button label={t('Ishlab chiqarilgan homashyolar')} systemImage="shippingbox" onPress={() => router.push('/ios-preparation/inventory' as Href)} />
  <Button label={t('Tarix')} systemImage="clock.arrow.circlepath" onPress={() => router.push('/ios-preparation/history' as Href)} />
</Section>
```

- **Android** Compose Column spacing 2, bodyLarge 500 and rounded corners 16 at group edges/4 at inner edges. ListItem height follows Material defaults. The group has an outer −8 horizontal margin in PreparationPage. `src/preparation/PreparationHome.android.tsx:82`.

- **iOS** PreparationList wraps an insetGrouped native List. Section contains seven labelled SF Symbol Buttons. Row height, shape, type size and insets are SwiftUI defaults. `src/preparation/PreparationUI.ios.tsx:15` and `src/preparation/PreparationHome.ios.tsx:44`.

- **Behavior** Home takes its state from PreparationContext. The module row opens a route and carries no selected or loading state of its own. Home supplies no pull-to-refresh callback. Android actions include a separate FAB and iOS includes an actions Menu. Production journal uses push on Android and replace on iOS. `src/preparation/PreparationHome.android.tsx:55` and `src/preparation/PreparationHome.ios.tsx:49`.

#### Headers and safe-area ownership

```ts
type RoleHeaderProps = {
  title: string; subtitle?: string;
  navigation?: { icon: 'menu' | 'back'; label: string; onPress: () => void };
  actions?: ReactNode; profileAction?: ReactNode;
};
```

`src/preparation/PreparationUI.android.tsx:94`

```tsx
<View style={{ flex: 1 }}><RoleHeader title={t(title)} subtitle={subtitle ? t(subtitle) : undefined} navigation={navigation} /></View>
<RoleHeaderButton icon="profile" label={t('Profil')} testID="header-profile" tintColor={colors.onSurfaceVariant}
  onPress={() => router.navigate('/android-preparation/profile' as Href)} />
```

- **Android** Standard role controls use 70 min height, 10/6 padding, 6 gap and 38×48 icon buttons by shared metrics. PreparationPage places the header under the top safe inset. `src/shared/navigation/roleNavigationMetrics.ts:1` and `src/preparation/PreparationUI.android.tsx:92`.

- **iOS** Worker uses native SwiftUI Toolbar while Preparation uses Stack titles. Header buttons can use 44×44 iOS profile targets and menu/back accessibility labels. `src/shared/orders/OrdersWorkspace.ios.tsx:34`, `src/preparation/PreparationHome.ios.tsx:42` and `src/shared/navigation/RoleHeaderButton.tsx:36`.

- **Behavior** Caller controls menu/back/profile and injects actions. RoleProfileButton can route long press to account switching. The scrollable search header is separate from a non-search title. Android Back and route fallback remain in the page owner. `src/shared/navigation/RoleHeaderButton.tsx:9` and `src/preparation/PreparationUI.android.tsx:88`.

#### Loading, empty and error states

```ts
type QueueProgressProps = { active: boolean };
type PreparationStatusProps = { loading: boolean; error: string | null; retry: () => void };
type AdminLoadingIndicatorProps = { size?: number; glyphSize?: number };
```

`src/WorkerScreen.tsx:584`

```tsx
<WorkerQueueConnectionProgress active={loading || retryingQueue} />
{error ? <ListItem supportingText={error} onPress={() => { void reload(true); }}>{p('worker.action.retry')}</ListItem> : null}
```

`src/preparation/PreparationWarehouse.ios.tsx:99`

```tsx
<PreparationStatus loading={home.loading} error={home.error} retry={() => { void controller.reload(); }} />
```

- **Android** Queue progress is a native ActivityIndicator with padding 8 and theme icon tint. Admin's V2-style Expressive indicator uses default size 64 and glyph 38, with available small values 48 and 28. `src/components/WorkerQueueConnectionProgress.android.tsx:6` and `src/admin/AdminLoadingIndicator.android.tsx:6`.

- **iOS** Worker centers a SwiftUI ProgressView. PreparationStatus combines native ProgressView and Section text/retry button with system typography. `src/components/WorkerQueueConnectionProgress.ios.tsx:5` and `src/preparation/PreparationUI.ios.tsx:18`.

- **Behavior** Worker delays the spinner by 300 ms, distinguishes retryable reconnect from hard errors, and suppresses empty copy while the filtered window is provisional. Error press calls forced reload. PickerSheetContent has explicit busy/error/empty props. `src/components/useWorkerQueueProgress.ts:4`, `src/WorkerScreen.tsx:151` and `src/components/WorkerSearchQueueList.tsx:48`.

#### Segmented cards and order rows

```ts
type WorkerQueueCardProps = {
  children: ReactNode; backgroundColor: ColorValue;
  first?: boolean; last?: boolean; disabled?: boolean;
  onPress?: () => void; onLongPress?: () => void;
};
```

`src/shared/orders/OrderListItem.android.tsx:17`

```tsx
return <WorkerQueueCard backgroundColor={appearance.color ?? colors.surface} backgroundImage={appearance.gradient} first={first} last={last} onPress={onPress} onLongPress={onLongPress}>
    <WorkerOrderThumbnail session={session} orderId={orderId} imageId={imageId} active={imageActive} backgroundColor={colors.surfaceContainerHighest} iconColor={colors.onSurfaceVariant} />
    <View style={styles.text}>
      <Text numberOfLines={1} style={[styles.headline, { color: appearance.text ?? colors.onSurface, fontFamily: headlineFontFamily, fontWeight: headlineFontFamily ? undefined : '500' }]}>{headline}</Text>
      {supportingText ? <Text numberOfLines={1} style={[styles.supporting, { color: appearance.secondary ?? colors.onSurfaceVariant, fontFamily }]}>{supportingText}</Text> : null}
    </View>
</WorkerQueueCard>;
```

- **Android** Card is 56 minimum, with inner 8/6 horizontal/vertical padding and 8 outer horizontal. End corners are 16 and interior corners are 4. Interior vertical margins use 1. Orders use 16/24 and 14/20 text. `src/components/WorkerQueueCard.android.tsx:10` and `src/shared/orders/OrderListItem.android.tsx:26`.

- **iOS** OrderListItem uses SwiftUI rows with 8 vertical/16 horizontal insets, 44 square thumbnail and dynamic body/subheadline/caption. The visible status marker and row content are drawn in the List. `src/shared/orders/OrderListItem.ios.tsx:36`.

- **Behavior** Android Pressable supports ripple, tap, long press, disabled and accessibility activation for long-press-only rows. iOS combines accessibility elements and assigns a button trait for gesture rows. Caller owns selected and live status. `src/components/WorkerQueueCard.android.tsx:17` and `src/shared/orders/OrderListItem.ios.tsx:53`.

#### Selectable chips and status marks

```ts
type ChoiceChipsProps = {
  options: { label: string; selected: boolean; onChange: (value: boolean) => void }[];
  disabled?: boolean;
};
```

`src/brigader/BrigaderApparatusSurfaces.tsx:20`

```tsx
<Label>{a('apparatus.capabilities')}</Label><ChoiceChips disabled={state.saving} options={options.capabilities.map(code => ({ label:optionLabel(code),selected:editor.capabilities.includes(code),onChange:value => { if (interactive()) owner.capability(code,value); } }))} />
```

- **Android** Choice chips wrap with 8 gap in each direction. Material FilterChip sets size and label metrics. Admin expandable chips often use elevation 2 plus an 18 icon and labelLarge/500. `src/brigader/BrigaderForm.android.tsx:36` and `src/admin/AdminUsersScreen.android.tsx:56`.

- **iOS** The paired Brigader UI is a native Toggle VStack with gap 8. Other iOS admin filters use DisclosureGroup, Grid or menu Picker. Status dots use native caption style in the order list. `src/brigader/BrigaderForm.ios.tsx:24`, `src/admin/AdminUsersScreen.ios.tsx:20` and `src/shared/orders/OrderListItem.ios.tsx:46`.

- **Behavior** Labels and checked state are controlled. Caller mutates the option model and can disable all choices. Keep selectable filter controls distinct from informational status text. `src/brigader/BrigaderApparatusSurfaces.tsx:20`.

#### Confirmations and form dialogs

```ts
type WorkerAlertProps = { alert: WorkerAlertData | null; onDismiss: () => void; onCancel?: () => void };
type WorkerFormDialogProps = {
  visible: boolean; title: string; children: ReactNode;
  confirmLabel: string; onConfirm: () => void; confirmDisabled?: boolean;
  onCancel: () => void; cancelDisabled?: boolean; preventDismiss?: boolean;
};
```

`src/WorkerScreen.tsx:608`

```tsx
<WorkerAlert alert={alert} onDismiss={() => setAlert(null)} />
```

- **Android** Compose AlertDialog supplies native chrome and text buttons. The progress variant caps width at 480, uses 48-high actions with 14 corners and a scroll body at 60% screen height. The ordinary form scroll cap is 55%. `src/components/WorkerFormDialog.android.tsx:13`.

- **iOS** Simple alerts use SwiftUI Alert. WorkerFormDialog has an RN modal frame up to 560 wide with radius 26, padding 20, gap 16, 22 semibold title and native min-48 action buttons. `src/components/WorkerAlert.ios.tsx:9` and `src/components/WorkerFormDialog.ios.tsx:19`.

- **Behavior** Alert data is nullable and has an optional confirm callback. Form controls own disabled and busy gates, scroll the keyboard body and manage cancel or backdrop according to props. The iOS form marks accessibilityViewIsModal and uses interactive keyboard dismissal. `src/components/workerDialogTypes.ts:4` and `src/components/WorkerFormDialog.ios.tsx:24`.

#### Controlled form input

```ts
type WorkerReportFieldProps = {
  label: string; value: string; change(value: string): void;
  decimal?: boolean; multiline?: boolean; disabled?: boolean; focus?: number;
};
```

`src/preparation/PreparationProductionNoteDialog.android.tsx:13`

```tsx
<WorkerReportField label={t('Eslatma')} value={state.draft} change={editor.change} multiline focus={1} disabled={state.saving} />
```

- **Android** Full-width Compose OutlinedTextField uses platform height and typography, decimal or text keyboard, and an optional multiline mode. PreparationField adds an optional suffix and initial-value semantics. `src/components/WorkerReportField.android.tsx:7` and `src/preparation/PreparationUI.android.tsx:36`.

- **iOS** SwiftUI rounded-border text field in a leading VStack with spacing 6 and native typography. Decimal mode uses decimal-pad. `src/components/WorkerReportField.ios.tsx:7`.

- **Behavior** Native state sync follows controlled value and a numeric focus trigger. Caller owns validation and text mutation. Keyboard paths use native labels and disable input during write. `src/components/workerReportFieldTypes.ts:1` and `src/preparation/PreparationProductionNoteDialog.ios.tsx:16`.

#### Picker sheet content

```ts
type PickerItem = { key: string; title: string; subtitle?: string; select: () => void };
type PickerSheetContentProps = {
  title: string; hint: string; closeLabel: string; emptyLabel: string; items: readonly PickerItem[];
  onClose: () => void; onSearch: (query: string) => void;
  loading?: boolean; error?: string; onRetry?: () => void; retryLabel?: string;
  hasMore?: boolean; onLoadMore?: () => void;
};
```

`src/preparation/PreparationSeriyoPicker.ios.tsx:11`

```tsx
return <PickerSheetContent title={t(title)} hint={t('Qidirish')} closeLabel={t('Yopish')}
  emptyLabel={t('Bu ro‘yxatda hozircha yozuv yo‘q.')} onClose={close} onSearch={picker.setQuery}
  items={picker.items.map(item => ({ key: item.code, title: item.name || item.code,
    subtitle: subtitle?.(item), select: () => choose(item) }))}
  hasMore={picker.hasMore} onLoadMore={picker.loadMore} />;
```

- **Android** Picker row text is 20/26 and 12/17. Search is minimum 58 with radius 30 and horizontal padding 18. Header title is 22/28. `src/shared/orders/PickerSheetContent.android.tsx:68`.

- **iOS** SwiftUI title2 and title3/caption. Search wrapper radius 30 with horizontal/vertical padding 16/12. Rows use vertical padding 8 and content gap 6. `src/shared/orders/PickerSheetContent.ios.tsx:27`.

- **Behavior** Selection is per item, while query, errors, retry, optional photo action and paging are caller-owned. Android loads at list end and persists taps when the keyboard is up. iOS observes the last row appearing. The content sits inside a caller-owned presentation. `src/shared/orders/PickerSheetContent.android.tsx:50` and `src/shared/orders/PickerSheetContent.ios.tsx:39`.

## A3. Patterns

| Pattern | State and flow | Canonical reference |
| --- | --- | --- |
| Filter + list | Track apparatus, queue limit, raw text plus committed search and loaded window. Preview cached rows locally while a 350 ms debounce starts the server query. Limit is saved per origin, role and ref. Apparatus and query are screen state. | `src/WorkerScreen.tsx:117` · `src/workerSearchInput.ts:30` · `src/workerQueueLimit.ts:27` |
| Data loading | useWorkerQueue owns a controller per session/query/limit. It claims a warm lease, restores disk data, reads a baseline and follows live updates. Refresh reloads queue and catalog. Show the error retry or stable empty state after the loaded window catches up. | `src/components/useWorkerQueue.ts:15` · `src/workerQueueController.ts:248` · `src/WorkerScreen.tsx:550` |
| Item tap → bottom sheet | Guard frozen or overlapping presentations and preserve fresh-detail checks for previews. Android pushes the native-sheet route. iOS stores a keyed presentation in the screen. Order bodies own mutations and guards. See the detents in A2. | `src/WorkerScreen.tsx:206` · `src/nativeSheet.tsx:92` · `src/components/WorkerOrderSheet.ios.tsx:46` |
| Search in top bar | Use native input text on the edit path and subscribe the queue to the committed query. Worker Android mounts OrdersHeader in the pager overlay. Worker iOS uses the native toolbar searchable modifier over the selected list. | `src/components/WorkerSearchHeader.tsx:8` · `src/WorkerScreen.tsx:542` · `src/shared/orders/OrdersWorkspace.ios.tsx:26` |
| Tabs with lists | Worker derives tabs from apparatus and Completed. Android retains pages while IDs are stable and virtualizes each list. iOS mounts selected content. Worker shares query/limit across tabs. Preserve independent tab state only when the role controller owns it. | `src/components/workerTabModel.ts:1` · `src/shared/orders/OrdersWorkspace.android.tsx:221` · `src/shared/orders/OrdersWorkspace.ios.tsx:32` |
| Drawer + dock | WorkerDrawer maps role destinations and permissions into RoleDrawer. Android Worker renders WorkerBottomBar and WorkerFab in its screen. iOS layout owns RoleTabs, route navigation and drawer open state. Keep Chat badge and action availability in the role owner. | `src/WorkerScreen.tsx:592` · `src/components/WorkerDrawer.android.tsx:7` · `src/app/ios-worker/_layout.tsx:36` |
| Module list | Define route/action data in Preparation home. Compose uses clipped grouped ListItems. SwiftUI uses List, Section and Buttons. Both route to the same modules. Keep capability gating and receipt workflow in the owner. | `src/preparation/PreparationHome.android.tsx:73` · `src/preparation/PreparationHome.ios.tsx:43` |
| ChangeNotifier-style port | Controllers keep immutable snapshots and explicit subscriptions. Hook consumers use useSyncExternalStore and the context scopes lifecycle and session. AdminStore and PreparationHomeState show the same listener pattern as the queue controller. | `src/admin/adminStore.ts:12` · `src/components/useWorkerQueue.ts:47` · `src/preparation/usePreparationHome.ts:108` |

The queue's real network window sends `queue_limit` and trimmed `queue_search` on the Worker projection. Reload and reconnect use a revision cursor when valid. Client preview is allowed only while the screen has read authority. The Worker queue size selector changes a window. It is independent of incremental paging in screens such as Preparation production history. `src/workerQueueReadApi.ts:14` · `src/components/WorkerSearchQueueList.tsx:25` · `src/preparation/PreparationProduction.android.tsx:122`.

## A4. Theme and tokens

| Area | Implementation | Evidence |
| --- | --- | --- |
| State and dark mode | ThemeController stores light/dark/system. AppSettings bridges it to profile controls. useBaseThemeConfig resolves system from useColorScheme and derives RTL for Urdu. | `src/shared/themeController.ts:5` · `src/components/AppSettings.tsx:18` · `src/components/useBaseThemeConfig.ts:12` |
| Android palette | Native Material semantic colors from useMaterialColors with the mode override in useBaseTheme. Direct native Hosts/components in some screens also request Material colors locally. | `src/components/useBaseTheme.android.ts:4` · `src/components/BaseHost.android.tsx:5` · `src/preparation/PreparationHome.android.tsx:22` |
| iOS palette | Semantic PlatformColor tokens map to UIColor labels, fills, grouped backgrounds and separator. BaseHost passes an explicit mode/direction to SwiftUI. Some raw PlatformColor calls resolve against the OS trait. | `src/components/useBaseTheme.ios.ts:5` · `src/components/BaseHost.ios.tsx:5` |
| Root navigation | Expo Router ThemeProvider sets surface/card/primary/text/border. Android also sets the system background. Root updates text layout direction. | `src/app/_layout.tsx:14` |
| V2 seed variants | themePalettes.json carries classic, kalmar, moss, lavender, bliss and white light/dark palettes. The base fallback hook reads classic only. Native hooks use platform colors. The V4 controller persists mode and exposes no variant switch or runtime ColorScheme.fromSeed. | `src/shared/themePalettes.json:1` · `src/components/useBaseTheme.ts:4` · `src/shared/themeController.ts:6` |
| Typography | Google Sans files live in assets/fonts. Android Worker loads Regular/Medium for rows. AdminTypography/its font mapping are Admin-scoped. iOS generally uses native body/title/caption styles, including the Worker List and Preparation home. | `src/WorkerScreen.tsx:80` · `src/admin/AdminTypography.android.tsx:9` · `src/admin/adminFontFamily.android.ts:1` |
| Spacing and shape | roleNavigationMetrics supplies shared header/dock sizes. RoleHeaderRow and WorkerQueueCard own search and segmented surface sizes. Preparation module shapes live in the Android home. | `src/shared/navigation/roleNavigationMetrics.ts:1` · `src/shared/navigation/RoleHeaderRow.tsx:21` · `src/components/WorkerQueueCard.android.tsx:10` |

V2 theme definitions live in `../accord_mobile_v2/lib/src/core/theme/app_theme.dart` and its parts. V4 preserves the palette data but native components obtain their active palette from the platform. Variant parity depends on the target surface and whether it reads the JSON.

## A5. Golden reference screens

These are reference files for the stated context. The conflict list gives the alternative implementations where scope or behavior differs.

| Pattern | Reference file to copy from | Why this example |
| --- | --- | --- |
| Apparatus filter + list | `src/WorkerScreen.tsx:548` · `src/components/WorkerSearchQueueList.tsx:25` | Implements request window, preview gating, controlled limit and canonical row IDs in one flow. |
| Android Worker tabs + list | `src/shared/orders/OrdersWorkspace.android.tsx:214` · `src/WorkerScreen.tsx:542` | Contains pager, scrollable strip and collapsing header wired to the live order page. |
| iOS Worker tabs + search | `src/shared/orders/OrdersWorkspace.ios.tsx:12` · `src/app/ios-worker/(home)/index.tsx:5` | Native apparatus menu and toolbar search use the same list tree and route owner. |
| Worker order sheet | `src/WorkerScreen.tsx:206` · `src/WorkerScreen.tsx:596` | Both platform openings and the frozen/read-only/overlap guards are visible at the source tap. |
| Worker buttons | `src/OrderScreen.tsx:1120` · `src/components/WorkerIconButton.android.tsx:7` · `src/components/WorkerIconButton.ios.tsx:7` | Shows the 48 Android caller override and the corresponding native iOS control policy. |
| Worker search header | `src/WorkerScreen.tsx:532` · `src/components/WorkerSearchHeader.tsx:8` | Separates immediate native edits from the debounced queue request. |
| Worker drawer | `src/WorkerScreen.tsx:620` · `src/app/ios-worker/_layout.tsx:47` | Both route ownership modes and Worker-specific gated destinations are visible. |
| Preparation home module list | `src/preparation/PreparationHome.android.tsx:73` · `src/preparation/PreparationHome.ios.tsx:43` | Complete module menu with native grouping on each platform and route/action differences. |
| Paged picker in a role sheet | `src/preparation/PreparationSeriyoPicker.android.tsx:11` · `src/preparation/PreparationSeriyoPicker.ios.tsx:11` | Shared row mapping with local query paging and a platform-appropriate sheet caller. |
| Rendered list state | `src/WorkerScreen.tsx:554` · `src/preparation/PreparationUI.ios.tsx:18` | Stable empty, loading and retry affordances have visible reference implementations. |

### CONFLICTS

| ID | V2 widget or pattern | Existing V4 paths | Difference | Evidence |
| --- | --- | --- | --- | --- |
| C01 | AppShell / AdminShell | AdminLayout + AdminShellBodyFrame · PreparationPage · inline Worker shell on Android · role router layout on iOS. | State, safe-area, drawer and footer ownership differ by role. | `src/admin/AdminHomeScreen.android.tsx:38` · `src/preparation/PreparationUI.android.tsx:78` · `src/WorkerScreen.tsx:538` |
| C02 | AppRefreshIndicator / RefreshIndicator | OrdersList RN refresh, PreparationPage ScrollView refresh, SwiftUI OrdersList/PreparationList refreshable. | Animation/insets and keyboard are decided by the list host. | `src/shared/orders/OrdersList.android.tsx:104` · `src/preparation/PreparationUI.android.tsx:98` · `src/preparation/PreparationUI.ios.tsx:15` |
| C03 | AppLoadingIndicator / AppRetryState | AdminLoadingIndicator, WorkerQueueConnectionProgress, PreparationStatus and Brigader FeatureBusy/FeatureError. | Immediate expressive loading, delayed reconnect and error/retry sections use different contracts. | `src/admin/AdminLoadingIndicator.android.tsx:6` · `src/WorkerScreen.tsx:584` · `src/preparation/PreparationUI.ios.tsx:18` · `src/brigader/BrigaderList.ios.tsx:20` |
| C04 | M3SegmentFilledSurface / AppSegmentSurfaceCard / SoftCard | WorkerQueueCard, private inactive-supplier SoftCard, PreparationRow, native iOS grouped rows. | Segment slot corners, shadow, padding and tap feedback are independently owned. | `src/components/WorkerQueueCard.android.tsx:10` · `src/admin/AdminInactiveSuppliersScreen.android.tsx:21` · `src/shared/orders/OrderListItem.ios.tsx:36` |
| C05 | AdminExpandableFilterChip / FilterChip | Worker DropdownFilter, Admin inline FilterChip expansion, BrigaderExpandableFilter, native disclosure/toggle controls. | Menu dismissal, selection representation and support for a long-press option differ. | `src/shared/filters/DropdownFilter.android.tsx:15` · `src/admin/AdminUsersScreen.android.tsx:56` · `src/admin/AdminUsersScreen.ios.tsx:20` · `src/brigader/BrigaderExpandableFilter.ios.tsx:5` |
| C06 | TabBar / AdminSurfaceTabBar / SegmentedButton | OrdersWorkspace Android pager, iOS apparatus menu, Admin stock Tabs, WorkMap Compose/SwiftUI segments. | List lifetime and scrollable versus bounded selection differ. | `src/shared/orders/OrdersWorkspace.android.tsx:214` · `src/shared/orders/OrdersWorkspace.ios.tsx:12` · `src/admin/AdminWarehouseMainScreen.android.tsx:168` · `src/admin/AdminWorkMapControls.ios.tsx:8` |
| C07 | showModalBottomSheet (order and owned detail) | Worker Android route + Compose sheet, Worker iOS keyed inline SwiftUI, Admin item-create portal. | Different owner holds presentation identity, dismissal and interaction locks. | `src/WorkerScreen.tsx:206` · `src/app/sheet/[id].tsx:19` · `src/WorkerScreen.tsx:596` · `src/admin/AdminItemCreateOverlays.android.tsx:17` |
| C08 | AdminCatalogSearchField / search top bar | OrdersHeader with native input, Worker iOS toolbar searchable, AdminItemCreateHeader and Admin Users native search bar. | Native search position, focus ownership, clear and selection are different. | `src/shared/orders/OrdersHeader.tsx:27` · `src/shared/orders/OrdersWorkspace.ios.tsx:26` · `src/admin/AdminItemCreateHeader.android.tsx:25` · `src/admin/AdminUsersScreen.ios.tsx:85` |
| C09 | Filled/Outlined/Text/IconButton | WorkerSheetButton universal, platform WorkerIconButton, native PreparationButton, Admin action controls. | Icon size override, layout, variant styling and affordance differ by role/platform. | `src/components/WorkerSheetButton.tsx:22` · `src/components/WorkerIconButton.android.tsx:7` · `src/components/WorkerIconButton.ios.tsx:7` · `src/preparation/PreparationUI.android.tsx:30` |
| C10 | RoleDock / AdminDock / AdminFabActionMenu | WorkerBottomBar/Fab, RoleBottomBar/RoleFab, native RoleTabs and Admin create hub/owned dock. | Route ownership, safe-area and keyboard handling are different contracts. | `src/WorkerScreen.tsx:593` · `src/app/ios-worker/_layout.tsx:51` · `src/admin/AdminOwnedRoutePage.ios.tsx:25` · `src/admin/AdminCreateHubHost.ios.tsx:13` |
| C11 | M3PickerSheet / M3AsyncPickerSheet | Shared PickerSheetContent, AdminItemCreatePicker and a dedicated Worker pallet picker. | Paging and search ownership differ. Dedicated pickers can add role-specific actions or staged results. | `src/preparation/PreparationSeriyoPicker.ios.tsx:11` · `src/admin/AdminItemCreatePicker.android.tsx:55` · `src/components/WorkerPaddonPicker.ios.tsx:1` |
| C12 | AppStatusChip / AppInfoRow / AppDetailField | iOS order status and role metadata chips, daily work InfoRow, Admin ItemDetailRow. | Status/card treatment and label/value sizing differ. No common field contract resolves all uses. | `src/shared/orders/OrderListItem.ios.tsx:43` · `src/admin/AdminCustomerDetailNative.android.tsx:73` · `src/components/DailyWorkScreen.android.tsx:40` · `src/admin/AdminItemDetailNative.android.tsx:22` |
| C13 | AlertDialog / AppTextInput dialog | WorkerAlert, WorkerFormDialog, PreparationInputDialog and direct native Alert in scoped flows. | Form validation, cancellation, keyboard containment and confirmation ownership differ. | `src/components/WorkerAlert.android.tsx:9` · `src/components/WorkerFormDialog.ios.tsx:19` · `src/preparation/PreparationInputDialog.ios.tsx:9` · `src/preparation/PreparationInventoryAssignmentSection.ios.tsx:21` |
| C14 | AppActionSheet | WorkerLongPressActions, Werka PDF BottomSheet and Preparation native menu. | Role adapters expose different action data and dismissal/result semantics. | `src/components/WorkerLongPressActions.tsx:39` · `src/werka/WerkaArchivePdfActionSheet.android.tsx:8` · `src/preparation/PreparationHome.ios.tsx:53` |
| C15 | Preparation module list / M3SegmentSpacedColumn | Android grouped Compose ListItem menu and iOS Section/Button menu. | Visual grouping is platform-native. Production journal navigation is push vs replace. | `src/preparation/PreparationHome.android.tsx:73` · `src/preparation/PreparationHome.ios.tsx:43` |
| C16 | PressableScale / SpringPressable | Worker row ripple, RoleHeaderButton pressed style and native SwiftUI controls. | Action semantics carry over. Press scale/spring timing is absent from the shared adapter props. | `src/components/WorkerQueueCard.android.tsx:17` · `src/shared/navigation/RoleHeaderButton.tsx:25` · `src/components/WorkerIconButton.ios.tsx:23` |
| C17 | RoleNavigationDrawer / AdminNavigationDrawer | RoleDrawer Android front drawer, iOS back drawer, AdminDrawer and WorkerDrawer role adapters. | Edge gestures, overlay treatment and route ownership differ. Admin and Worker each supply destination policy. | `src/shared/navigation/RoleDrawer.android.tsx:27` · `src/shared/navigation/RoleDrawer.ios.tsx:39` · `src/admin/AdminDrawer.tsx:52` |
| C18 | M3ExpandableFilledSurface | WorkerExpansion with a caller-owned body · SwiftUI DisclosureGroup in Admin item groups. | Expansion state and reveal/layout belong to different owners. | `src/components/WorkerExpansion.android.tsx:8` · `src/components/WorkerExpansion.ios.tsx:8` · `src/admin/AdminItemCreateList.ios.tsx:19` |
| C19 | TextField / TextFormField | OrdersSearchInput, controlled WorkerReportField, initial-value PreparationField and AdminOutlinedTextField. | Setters, keyboard/focus callbacks, error ownership and semantic styling differ. | `src/shared/orders/OrdersHeader.tsx:42` · `src/components/WorkerReportField.android.tsx:7` · `src/preparation/PreparationUI.android.tsx:36` · `src/admin/AdminTextFields.android.tsx:1` |

## A6. Weak spots

| Area | Evidence |
| --- | --- |
| Worker-named shared pieces | WorkerQueueCard and WorkerSheetButton have dozens of non-Worker call sites. Admin and Preparation already use them. Candidate shared APIs are card chrome and button style. See A1 and `src/admin/AdminActivityScreen.android.tsx:23`. |
| Filter and catalog duplication | Admin users, item create, warehouses and work map each build native filter/group rows. Item create and users also own search focus handling. `src/admin/AdminItemCreateList.android.tsx:24` · `src/admin/AdminUsersScreen.android.tsx:56` · `src/admin/AdminWarehouseMainScreen.android.tsx:78`. |
| Uneven list capabilities | Android OrdersList exposes onEndReached. iOS callers use final-row onAppear or a separate More action. `src/shared/orders/OrdersList.android.tsx:99` · `src/shared/orders/OrdersList.ios.tsx:8` · `src/shared/orders/PickerSheetContent.ios.tsx:42`. |
| Generic detail metadata and tap feedback | V2's InfoRow, DetailField and press-motion contracts have local V4 compositions. Item detail and daily work differ in width and alignment. `src/admin/AdminItemDetailNative.android.tsx:22` · `src/components/DailyWorkScreen.android.tsx:40`. |
| Body/sheet ownership | Admin-owned pages and Worker sheets own dismissal, gestures and safe area in different layers. `src/admin/AdminItemCreateOverlays.android.tsx:17` · `src/nativeSheet.tsx:92` · `src/components/WorkerOrderSheet.ios.tsx:43`. |
| Visual state families | Admin's expressive loader, Worker connection spinner, PreparationStatus and FeatureError share intent and differ in UI/props. See A2. `src/admin/AdminLoadingIndicator.android.tsx:6` · `src/preparation/PreparationUI.ios.tsx:18` · `src/brigader/BrigaderList.android.tsx:20`. |
| Preparation home navigation | Production uses push on Android and replace on iOS. The module array and iOS buttons are defined separately, allowing drift. `src/preparation/PreparationHome.android.tsx:78` · `src/preparation/PreparationHome.ios.tsx:49`. |
| Identical tab adapters | The two WorkerTabs platform files both forward props and getWorkerTabs to OrdersWorkspace. The platform split starts in OrdersWorkspace. `src/components/WorkerTabs.android.tsx:4` · `src/components/WorkerTabs.ios.tsx:4`. |

## C. Reference screenshots

The available-device checks returned no iOS simulator device and no connected Android emulator. The reference evidence in A5 is source-based.
