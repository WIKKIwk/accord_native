# V2 (Flutter) → V4 (Expo) port rules

> If this repo already has an Expo-generated AGENTS.md section, keep it above this section.
> These rules apply to every port task. When something here conflicts with an older note, this file wins.

## 0. Projects and sources of truth
- **V4** = this repo (Expo SDK 58, React Native 0.88, TypeScript, Expo Router, `@/` = `src/`).
- **V2** = `../accord_mobile_v2` (Flutter). READ-ONLY. Never edit V2.
- V2 analysis: `../accord_mobile_v2/port-analysis/REPORT.md` (~1 MB). NEVER read it whole.
  Use `grep`/`rg` for the screen, route, endpoint or class you need. Useful sections:
  §4 routes and guards · §5 screens · §6 state units · §7 endpoints and models · §8 pure logic · §11 storage.
- UI dictionary: `docs/port/COMPONENT_MAP.md`. UI catalog: `docs/port/COMPONENT_CATALOG.md`.
- Existing port tracking: `.port/STATUS.md` and `docs/port/`. Read them before starting any screen.
- V2 source is mechanically split into `part` files (`*_part_01.dart`, `*_methods_01.dart`, `*_resplit_*`).
  A screen's logic is spread across ALL its parts. Read every part before porting.
- Role names: V4 "Worker" = V2 **Aparatchi** (`/apparatus-queue`). V4 "Tayyorlov Masteri" = V2 preparation workspace.

## 1. Scope (decided by the owner)
- Platforms: Android + iOS (iPhone and iPad). NO web, NO Windows/Linux.
  → Ignore V2 `*_web.dart`, `sqflite_common_ffi_web`, the web debug proxy and desktop branches.
- Android in-app APK self-update: KEEP (custom Android module).
- No data migration from V2: skip legacy-key migration code paths. A fresh login in V4 is fine.
- Iroh / LAN transport: NOT in V4. HTTPS only. Port V2's HTTPS behavior and ignore Iroh paths.
- Firebase / push: LAST step. Keep it behind an interface. Don't implement it until the owner says so.

## 2. Platform scope: ANDROID FIRST
- Build and verify UI on **Android only**. Do NOT design, style or test iOS UI now.
- The owner will do iOS later, after Worker and Tayyorlov Masteri are finished on iOS.
- Rules that keep the later iOS pass cheap:
  - **Logic never lives in `*.android.tsx`.** State, API calls, validation, formatting and permission
    checks go into shared controllers/hooks/services. Platform files contain UI only.
  - **Never break the iOS bundle.** The owner works on iOS in parallel. Every new `X.android.tsx` needs a
    sibling that resolves on iOS (`X.ios.tsx` or `X.tsx`). For new Android-only UI, add a minimal `X.tsx`
    fallback. Import Android-only modules (e.g. `WorkerQueueCard.android`, `AdminLoadingIndicator.android`)
    ONLY from `*.android.tsx` files.
  - Log every Android-only UI piece as one line under **"iOS TODO"** in the role's PLAN.md
    (component + file). No iOS work, just the list.

## 3. Logic: 1:1 with V2
- Same API calls (endpoint, method, params, headers, idempotency keys), same validation rules and messages,
  same state transitions, same loading/empty/error handling, same edge cases, same capability checks.
- Never "improve" or simplify logic silently. Every deviation from V2 goes in the report with the reason.
- V2 state is `ChangeNotifier` / `ValueNotifier` + singletons. Port it with the EXISTING V4 pattern:
  a controller class with an immutable snapshot + `subscribe`, consumed via `useSyncExternalStore`.
  References: `src/admin/adminStore.ts`, `src/components/useWorkerQueue.ts`, `src/preparation/usePreparationHome.ts`.
  Keep the same fields and method names as V2 where possible, so the two can be compared line by line.
- Capability gates come from V2 §4 (`canOpenRoute`, role allowlists B/R/S). Preserve them exactly.
- Persistent pending-command IDs, revision/fingerprint checks and live-delta handling (V2 §7, §11) are
  correctness contracts, not details. Port them with the screen that uses them.
- If V2 logic has a test in `../accord_mobile_v2/test/`, port its cases (inputs → expected outputs) to the
  V4 test runner. If V4 has no runner for that area, list the V2 tests in PLAN.md and ask.

## 4. Admin is shared, not a standalone role
- V2 admin screens also serve other roles: `AdminHomeScreen` = admin, sales, brigader.
  `AdminProductionMapOrdersScreen` with `readOnly` = qolip-tasks, material-tasks, supply-sequence, apparatus-queue.
- In V4, Brigader already reuses Admin components (e.g. `BrigaderItemCreate` → `AdminItemCreateScreen`).
- Before changing ANY `src/admin/*` file, search for every consumer (`rg "<ComponentName>" src`) and keep
  their behavior unchanged. Preserve `readOnly`, `initialTab`, `workerMode` and other presets.
- Much of Admin already exists in V4 (`AdminLayout`, `AdminShellBodyFrame`, `AdminScreenHeader`, `AdminDrawer`,
  `AdminBottomBar`/`AdminOwnedDock`, `AdminUsersScreen`, `AdminItemCreate*`, `AdminWarehouse*`, `AdminWorkMap*`,
  customer/supplier/worker detail, …). Check `.port/STATUS.md` and `src/admin/` FIRST.
  Finish or fix what exists. Never create a parallel second version of a screen.

## 5. Components: NEVER guess
- `docs/port/COMPONENT_MAP.md` is the law for UI mapping. Before writing any screen, add a table to PLAN.md:
  every V2 widget in that screen → V4 component (with the rule used).
- A widget missing from the map, or an ambiguous rule → **STOP and ask**. Never pick "something similar".
- A new shared component is added to the map only after the owner approves it.

### 5.1 Android decisions (these resolve the CONFLICTS in COMPONENT_MAP B3 for Android)
The owner confirmed that Worker and Tayyorlov Masteri are the correct references.

| Need (V2 widget) | Android: use this | Reference |
| --- | --- | --- |
| Page shell in Admin (`AppShell`, `AdminShell`) | `AdminLayout` + `AdminShellBodyFrame` + `AdminScreenHeader` | `src/admin/AdminHomeScreen.android.tsx` |
| Page shell in other roles | That role's existing page shell (e.g. `PreparationPage`) | `src/preparation/PreparationUI.android.tsx` |
| Long / paged / keyed list (`ListView.builder`, slivers) | `OrdersList` with `rows` + `rowKey` + `renderRow` | `src/shared/orders/OrdersList.android.tsx`, `src/WorkerScreen.tsx` |
| List row / segmented card (`M3SegmentFilledSurface`, `AppSegmentSurfaceCard`, `SoftCard`) | `WorkerQueueCard` (first/last corners 16/4), `OrderListItem` for order rows | `src/components/WorkerQueueCard.android.tsx` |
| Short static menu / module list (`M3SegmentSpacedColumn`) | Tayyorlov Masteri recipe: Compose `Column` spacedBy 2 + `ListItem`, corners 16 at edges / 4 inside | `src/preparation/PreparationHome.android.tsx` |
| Pull-to-refresh | `onRefresh` of the list host (`OrdersList` or the page shell). Never nest a second RefreshControl | `src/shared/orders/OrdersList.android.tsx` |
| Dropdown / menu filter | `DropdownFilter` (Worker filter pattern) | `src/components/WorkerQueueFilter.android.tsx` |
| Inline expandable filter chips (`AdminExpandableFilterChip`) | Inline Compose `FilterChip` expansion as in Admin Users (keeps V2 look) | `src/admin/AdminUsersScreen.android.tsx` |
| Tabs with lists (`TabBar` + `TabBarView`, `AdminSurfaceTabBar` with lists) | `OrdersWorkspace` (Worker tabs) | `src/components/WorkerTabs.android.tsx` |
| Small bounded choice (`SegmentedButton`) | Compose `SingleChoiceSegmentedButtonRow` | `src/admin/AdminWorkMapControls.android.tsx` |
| Search top bar (`AdminCatalogSearchField`, search `TextField`) | `OrdersHeader` (Worker search header, 350 ms debounce pattern) | `src/components/WorkerSearchHeader.tsx` |
| Bottom sheet on item tap (`showModalBottomSheet`) | `WorkerOrderSheet` through the native-sheet route | `src/WorkerScreen.tsx:206`, `src/nativeSheet.tsx` |
| Picker sheet (`M3AsyncPickerSheet`, `M3PickerSheet`) | `PickerSheetContent` + caller-owned controller | `src/preparation/PreparationSeriyoPicker.android.tsx` |
| Primary / secondary / text button | `WorkerSheetButton` (`filled` / `outlined` / `text`) | `src/components/WorkerSheetButton.tsx` |
| Icon button | `WorkerIconButton` (40 default, 48 when V2 is larger); `RoleHeaderButton` in headers | `src/OrderScreen.tsx:1120` |
| FAB / create menu | `RoleFab` (Admin: create hub owner) | `src/shared/navigation/RoleFab.android.tsx` |
| Drawer | `RoleDrawer` via the role adapter (`AdminDrawer`, `WorkerDrawer`) | `src/components/WorkerDrawer.android.tsx` |
| Bottom navigation (`RoleDock`, `AdminDock`) | `RoleBottomBar` via the role adapter (`AdminBottomBar`, `AdminOwnedDock`) | `src/admin/AdminBottomBar.android.tsx` |
| Confirmation (`AlertDialog`) | `WorkerAlert` | `src/components/WorkerAlert.android.tsx` |
| Form dialog | `WorkerFormDialog` | `src/components/WorkerFormDialog.android.tsx` |
| Form text input (`TextField`, `TextFormField`) | `WorkerReportField` (controlled) | `src/components/WorkerReportField.android.tsx` |
| Expand/collapse section (`M3ExpandableFilledSurface`) | `WorkerExpansion` + caller-owned body | `src/components/WorkerExpansion.android.tsx` |
| Full-page loading (`AppLoadingIndicator`) | `AdminLoadingIndicator` (V2 expressive, 64/38) | `src/admin/AdminLoadingIndicator.android.tsx` |
| Loading inside a live list (reconnect) | `WorkerQueueConnectionProgress` | `src/components/WorkerQueueConnectionProgress.android.tsx` |
| Press scale/spring (`PressableScale`, `SpringPressable`) | Do NOT reproduce the scale. Use the component's native ripple | `src/components/WorkerQueueCard.android.tsx` |

Not decided yet, so **STOP and ask** when a screen needs one of these:
`AppRetryState` (error + retry block), `AppInfoRow` / `AppDetailField`, `AppStatusChip`, `AdminSummaryCard`,
`AppActionSheet`, `TwoPaneTransfer`. These are GAPS (COMPONENT_MAP B4). They get built once as shared components.

### 5.2 Sizes
- Copy exact sizes, paddings, radii and typography from the V2 widget (dp → dp) when the mapped V4 component
  exposes them. Otherwise use the V4 component's defaults. Never invent new sizes.
- Colors: only theme hooks / Material colors (`useBaseTheme`, `useMaterialColors`). No hardcoded colors.
  Don't attempt V2 theme-variant work inside a role port.
- Admin text uses `AdminText` / `AdminTypographyProvider` (Google Sans), as existing Admin screens do.

## 6. Reuse rules
- Search V4 for an existing component before writing a new one: `src/components/`, `src/shared/`,
  `src/admin/`, `src/preparation/`, `src/brigader/`.
- Shared components (anything with consumers outside your screen): only ADD optional props.
  Never change existing behavior or defaults. Worker, Preparation and Brigader must not change.
- New generic components go to `src/shared/…`, not inside a role folder.
- Copy patterns from the golden references (COMPONENT_CATALOG A5), not from random screens.

## 7. Text and localization
- Use V4's existing `t()` mechanism. Keys are the Uzbek source strings, as in existing screens.
- Copy V2 strings EXACTLY, including the Uzbek apostrophes (`‘` `’`). Take en/ru/ur translations from V2's
  dictionaries. Never invent or "fix" a translation.
- Urdu is RTL. Keep V2's hardcoded `TextDirection` choices for codes, numbers and graphs.

## 8. Git and parallel work
- The owner works in this repo in parallel. Each role is ported in its own **git worktree** + branch
  `port/<role>` (e.g. `port/admin`). Work only inside that worktree.
- Never merge, rebase or push to `main`. Never force-push.
- Small commits, one per screen (or per shared component), with a clear message.
- Run Metro on port **8082** (`npx expo start --port 8082`). The owner uses the default port.

## 9. Port workflow (every role, every screen)
**Phase A — Plan (no code).** Create `docs/port/<role>/PLAN.md`:
1. Every V2 screen, dialog, sheet, state unit, endpoint, capability gate and edge case of the role, as a ☐ checklist.
2. For each item: does V4 already have it? (`done` / `partial` / `missing` + file).
3. For each screen: the widget → component table (section 5).
4. GAPS that block the role, and open questions.
Then STOP and wait for the owner's approval, unless the owner said to continue.

**Phase B — Implement, one screen at a time.**
1. Read the V2 screen and ALL its parts. Grep REPORT §5–§8 for its state, endpoints and logic.
2. Port logic into a shared controller/hook (section 3). Port its V2 tests if they exist.
3. Build Android UI from mapped components only (section 5).
4. Run the checks (section 10).
5. Tick ☑ in PLAN.md, add "iOS TODO" lines, update `.port/STATUS.md` in its existing format, commit.
Keep PLAN.md current so the work can resume from it after an interruption.

## 10. Checks before every commit
- `npx tsc --noEmit` passes.
- `npx eslint <changed files>` passes.
- Tests for touched logic pass.
- iOS bundle still resolves: `npx expo export --platform ios --output-dir /tmp/ios-bundle-check`.
- Android: the screen opens and works on an emulator/device. If none is available, say so in the report.
  Never claim something was tested when it wasn't.

## 11. STOP and ask the owner when
- V2 logic is unclear or contradictory.
- A backend endpoint the screen needs is missing or behaves differently.
- A new npm package or a native (config plugin / module) change is needed.
- A shared component must change in a way that affects other roles.
- A V2 widget is not in COMPONENT_MAP, or it is one of the undecided GAPS.
- The work touches push/Firebase, Iroh, web or desktop (out of scope).

## 12. Final report (end of each role or work session)
1. PLAN.md checklist: V2 ↔ V4, every item ☑, or the reason it isn't.
2. Reused components.
3. New components created (and where).
4. Shared files changed, and the effect on other roles (Worker, Preparation, Brigader…).
5. Deviations from V2, with reasons.
6. iOS TODO list.
7. Checks run and their results (including what could not be tested).
8. Commits.
