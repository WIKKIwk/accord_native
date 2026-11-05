# base-ios

Status: in progress
Stopped at: reconcile the remaining profile surfaces and integrator-owned behavior with the base UI contract.

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| `LoginScreen` navigation | `LoginScreen`, `AppEntryScreen` | The platform login supports back, back-swipe and add-account callbacks, but the root entry does not yet open it from the welcome or saved-account chooser or clear the existing app-lock state after login. Verify the gesture on a device. |
| `ProfileScreen.tsx`, profile helpers | `ProfileScreen._openProfileEditor`, `_refreshProfile`, `_saveProfileChanges` | The shared owner must reconcile empty-nickname fallback, pending-avatar restoration, gallery sizing/quality, sequential save failures, cached-avatar fallback, pull-to-refresh and resume refresh. |
| `profileModel.ts` | `ProfileScreen._normalizeWerkaLabel` | Normalize the `werka` display and legal names to `Wmanager` as V2 does. |
| `WorkerSecurity`, `usePinSetupCore` | `PinSetupEntryScreen`, `PinSetupConfirmScreen`, `SecurityController` | iOS now presents entry and confirmation in stages, but the shared app-lock provider still requires the old PIN for replacement and removal; V2 clears or replaces it directly. Expose matching operations and navigation results. |
| `ProfileSettings.ios.tsx` | `_ProfileSettingsSheet`, `ProfileScreen._removePin` | The pre-existing Done action submits the remove-PIN form. V2 dismisses settings without that side effect; `tests/profilePinSettings.ios.test.cjs` currently asserts the old behavior and is outside this session's write scope. Reconcile the action and its test with the shared security change. |
| Profile-switch PIN | `PinSetupEntryScreen`, `PinSetupConfirmScreen`, `AccountSwitcherSheet` | Entry, confirmation and removal are connected to the distinct switch-PIN store in settings. The chooser must verify this PIN before switching, and the standalone PIN routes remain unconnected. |
| Settings updates | `_AppUpdateCheckDialog`, `AppUpdateCoordinator` | The manual update-check dialog needs the shared update service, installed-version adapter and presenter; an unsupported response cannot be shown without the V2 check. |
| Theme and locale integration | `ThemeController`, `LocaleController` | App-wide native rendering and RTL still need the shared root/provider integration. |

## Deviations candidates

## Test mode pending

Login test mode remains deferred under D3.

## Needs from the integrator

| Where | V2 reference | What is needed |
|---|---|---|
| `src/app/index.tsx` and security provider | `AppEntryScreen`, `LoginScreen.submitLogin` | Wire the account chooser/welcome entry, add-account/back navigation and unlock-after-login behavior to the iOS login surface. |
| Shared profile and security files listed above | `ProfileScreen`, `SecurityController` | Provide the V2-compatible shared profile/editor, refresh and app-lock behavior; these files are outside the iOS session's scope. |
| `tests/profilePinSettings.ios.test.cjs` | `ProfileScreen._removePin` | Update the existing test when the Done action and shared app-lock removal are reconciled with V2. |
| Shared update and appearance runtime | `AppUpdateCoordinator`, `ThemeController`, `LocaleController` | Connect update checks and apply persisted theme variants and localization/RTL throughout the app. iOS settings now persist the locale, theme variant and explicit light/dark mode. |

## Session verification and handoff

- Scope: compare the existing login, profile, settings and PIN surfaces with `base.md` and V2 baseline `7c87a54e`; no API methods were added or re-ported. The generated base reading list estimates 225k tokens across two parts; this focused review read only relevant contract and widget excerpts, and the exact token count was not measured.
- The ledger initially had no iOS boxes checked for the four requested surface groups. It now recognizes `LoginScreen` and `_ProfileSettingsSheet`; profile, selection and the standalone PIN routes remain unchecked because their listed gaps are not all resolved. A tag does not mean every behavior is complete.
- The full Node suite passed 742/742 on the final code. An earlier run alongside several type checks reported one failure whose details were not retained; two later full runs passed, including the exact gate command. Focused checks covered login, account switching, PIN storage and settings, theme, profile and avatar. Additional in-memory checks exercised login submission/back, app-lock confirmation and switch-PIN entry, mismatch, save and removal; no test files were changed.
- iOS and default TypeScript checks and Expo lint passed. Android TypeScript reports the same ten pre-existing worker-screen errors documented in `PORT.md`. Ledger check passed with the same five documented endpoint warnings.
- No simulator, emulator or device was used. On a physical iPhone, check login keyboard and back swipe, profile image preview and editor, PIN entry/confirmation and biometrics, and settings in light and dark mode. Check locale and theme persistence after restarting the app.
