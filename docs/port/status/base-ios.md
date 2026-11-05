# base-ios

Status: in progress
Stopped at: reconcile the remaining profile, settings and PIN surfaces with the base UI contract.

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| `LoginScreen` navigation | `LoginScreen`, `AppEntryScreen` | The platform login accepts back and add-account callbacks, but the root entry does not yet open it from the welcome or saved-account chooser, provide the back gesture, or clear the existing app-lock state after login. |
| `ProfileScreen.tsx`, profile helpers | `ProfileScreen._openProfileEditor`, `_refreshProfile`, `_saveProfileChanges` | The shared owner must reconcile empty-nickname fallback, pending-avatar restoration, gallery sizing/quality, sequential save failures, cached-avatar fallback, pull-to-refresh and resume refresh. |
| `profileModel.ts` | `ProfileScreen._normalizeWerkaLabel` | Normalize the `werka` display and legal names to `Wmanager` as V2 does. |
| `WorkerSecurity`, `usePinSetupCore` | `PinSetupEntryScreen`, `PinSetupConfirmScreen`, `SecurityController` | Shared app-lock storage/provider currently requires the old PIN for replacement and removal and combines entry and confirmation; V2 uses separate entry/confirmation and clears a PIN directly. Expose matching operations and screen state to the iOS session. |
| Settings updates | `_AppUpdateCheckDialog`, `AppUpdateCoordinator` | Native update platform adapters and dialog hooks are pending in the shared runtime. |
| Theme and locale integration | `ThemeController`, `LocaleController` | App-wide native rendering and RTL still need the shared root/provider integration. |

## Deviations candidates

## Test mode pending

Login test mode remains deferred under D3.

## Needs from the integrator

| Where | V2 reference | What is needed |
|---|---|---|
| `src/app/index.tsx` and security provider | `AppEntryScreen`, `LoginScreen.submitLogin` | Wire the account chooser/welcome entry, add-account/back navigation and unlock-after-login behavior to the iOS login surface. |
| Shared profile and security files listed above | `ProfileScreen`, `SecurityController` | Provide the V2-compatible shared profile/editor, refresh and app-lock behavior; these files are outside the iOS session's scope. |
| Shared update and appearance runtime | `AppUpdateCoordinator`, `ThemeController`, `LocaleController` | Connect update checks and apply persisted theme variants and localization/RTL throughout the app. |
