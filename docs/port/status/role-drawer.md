# role-drawer

Status: shared drawer implementation complete; native phone checks pending.
Stopped at: integrated into `main` at the user's request after confirming Expo serves the main checkout. Native phone checks remain pending.

## Scope

The user requested a reusable drawer for every role, following investigation of the preparation iOS popup. This is a shared component extraction and its worker/preparation connections, not a whole-role port.

- Extracted the existing worker's iOS animation, native rows, safe areas, scrolling, heading and optional footer into `src/shared/navigation/RoleDrawer.ios.tsx`.
- Extracted its Android Material drawer and Back handling into `RoleDrawer.android.tsx`.
- Added a shared item/props contract, controlled-state hook, descendant open/close context and iOS header button. The shell has no role, permission, session or route imports.
- Kept the existing native `WorkerDrawer` import/props API as small adapters. `components/workerDrawerModel.ts` supplies worker-specific content and transfer permission.
- Connected preparation's two native navigators once at their role root. Removed the iOS `Menu` popup and Android's separate inline drawer. Preparation supplies its title, ordered items, icons, access checks, active ID and navigation callbacks.
- Reused V2's localized logout confirmation for both consumers. Selecting the active destination only closes; disabled entries do nothing.
- Added API usage notes in `docs/port/roles/role-drawer.md`.

## Verification

- 14 focused drawer tests passed: role dispatch, disabled/active selection, account-specific worker content, preparation capability filtering/order, both platforms' route wiring, native shell callbacks/optional footer, Android Back cleanup and logout confirmation.
- Existing `tests/preparation*.test.cjs` suites passed alongside the drawer tests.
- Default and iOS TypeScript checks passed; Expo lint passed.
- Android TypeScript has the same 10 errors recorded before the edit, in `WorkerOutputProgress.android.tsx`, `WorkerPaintPalette.android.tsx` and `WorkerScreen.tsx`; no new errors.
- `git diff --check` passed.
- Main integration: all 988 tests passed; default and iOS TypeScript and Expo lint passed. Android retained exactly the 10 worker baseline errors listed above.
- V2 baseline is `7c87a54e`; current V2 is `f11910bb`. Drift was read, and the three drawer/navigation/logout reference files have no baseline-to-HEAD changes. No unrelated drift was ported.
- No simulator, emulator or physical device was used. Tests of native views mock their native bridge and do not verify gestures, rendering or animations on a phone. Full-role ledger/text gates are outside this requested component scope; no text exceptions were added.

## Surface audit

| V2 surface and location | V4 file | iOS | Android | What differs |
|---|---|---|---|---|
| `RoleNavigationDrawer`, `core/widgets/navigation/role_navigation_drawer.dart:23` | `shared/navigation/RoleDrawer.*.tsx` | Code compared | Code compared | Existing platform-native worker shell retained; destinations and title are caller data. Selecting a destination requests close before dispatch, retaining the V4 worker's timing rather than V2's fixed 220 ms delay. Native transition timing needs phone validation. |
| `PreparationDrawer`, `features/preparation/presentation/preparation_navigation.dart:70` | `preparation/PreparationDrawer.*.tsx`, `preparationDrawerModel.ts` | Code compared | Code compared | V2 title/order and conditional entries supplied. Chat remains disabled because its preparation destination is not connected. |
| `showLogoutPrompt`, `core/widgets/feedback/logout_prompt.dart:6` | `shared/navigation/roleDrawerLogout.ts` | Code compared | Code compared | Native alert preserves title/body, No/Yes order and cancel/outside-dismiss behavior. Device presentation not checked. |

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| Native devices | Drawer/AppShell gestures | Check worker and preparation in light/dark mode: hamburger/edge swipe, outside tap, long labels with large text, back navigation and Android hardware Back. Confirm the preparation header's back button coexists with its drawer button and both native tabs move with the drawer. |
| Preparation Chat (existing) | `PreparationDrawer` Chat destination | Preparation Chat is still disabled; this component extraction does not connect the chat role. |
| Android full-project typecheck (existing) | N/A | Resolve the 10 unrelated worker baseline errors in their owning task. |

## Deviations candidates

None introduced as a new product feature. Role-specific content and permission decisions remain outside the shared shell.

## Test mode pending

None for the drawer component itself.

## Needs from the integrator

`port/role-drawer` is integrated into `main`. Worker-native adapters are the only changed files owned by another role; they delegate to the shared shell while preserving existing caller props. Expo serves `/Users/wikki/Desktop/Accord_project/accord_mobile_v4` on port 8081.
