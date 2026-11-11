# base-ios

Status: in progress
Stopped at: reconcile the remaining profile surfaces and integrator-owned behavior with the base UI contract.

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| Profile-switch PIN | `PinSetupEntryScreen`, `PinSetupConfirmScreen`, `AccountSwitcherSheet` | Entry, confirmation and removal use the distinct switch-PIN store. Both saved-account entry and the in-session header chooser verify it. Standalone PIN routes remain unconnected; verify the native chooser on a real phone. |
| Theme and locale integration | `ThemeController`, `LocaleController` | Base entry, login and profile hosts apply the selected mode, tint and RTL. Other role-owned hosts and remaining hard-coded strings need integration in their own sessions. Verify the base surfaces on a device. |

## Deviations candidates

## Test mode pending

Login test mode remains deferred under D3.

## Needs from the integrator

| Where | V2 reference | What is needed |
|---|---|---|

## Session verification and handoff

- Scope: compare the existing login, profile, settings and PIN surfaces with `base.md` and V2 baseline `7c87a54e`; no API methods were added or re-ported. The generated base reading list estimates 225k tokens across two parts; this focused review read only relevant contract and widget excerpts, and the exact token count was not measured.
- The ledger initially had no iOS boxes checked for the four requested surface groups. It now recognizes `LoginScreen` and `_ProfileSettingsSheet`; profile, selection and the standalone PIN routes remain unchecked because their listed gaps are not all resolved. A tag does not mean every behavior is complete.
- The full Node suite passed 742/742 on the final code. An earlier run alongside several type checks reported one failure whose details were not retained; two later full runs passed, including the exact gate command. Focused checks covered login, account switching, PIN storage and settings, theme, profile and avatar. Additional in-memory checks exercised login submission/back, app-lock confirmation and switch-PIN entry, mismatch, save and removal; no test files were changed.
- iOS and default TypeScript checks and Expo lint passed. Android TypeScript reports the same ten pre-existing worker-screen errors documented in `PORT.md`. Ledger check passed with the same five documented endpoint warnings.
- No simulator, emulator or device was used. On a physical iPhone, check login keyboard and back swipe, profile image preview and editor, PIN entry/confirmation and biometrics, and settings in light and dark mode. Check locale and theme persistence after restarting the app.
