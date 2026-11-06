# base-wire

Status: in progress
Stopped at: finish avatar cache, security lifecycle, appearance and updates.

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| Push token reader | `FirebaseClientBootstrap`, `PushMessagingService` | Firebase configuration and a native FCM token reader remain outside this wire session. |
| Native APK installer | `NativeAppUpdatePlatform` | The native Android installer remains outside this wire session. |
| Login and account entry | `LoginScreen`, `AppEntryScreen`, `AccountSwitcherSheet` | Verify keyboard, login back swipe, saved-account PIN and unlock-after-login on real iOS and Android devices. |
| In-session account switch launcher | `showAccountSwitcherSheet`, `app_shell_helpers_part_01.dart` | The V2 launcher is on the worker-owned profile button; connect it in the aparatchi session. |
| Standalone PIN routes | `PinSetupEntryScreen`, `PinSetupConfirmScreen` | Settings now use the entry and confirmation flows for both PIN purposes, but other callers need Expo Router route files. The wire session may edit only `src/app/index.tsx` and `src/app/_layout.tsx`. |
| Avatar cache | `ProfileAvatarCache`, `ProfileScreen._refreshProfile` | Preserve cached bytes for failed refreshes and post-upload download failures. Verify image picking and rendering on a real phone. |

## Deviations candidates

## Test mode pending

Login test mode remains deferred under D3.

## Needs from the integrator

## Drift

V2 baseline `7c87a54e` to `f11910bb`: the login/welcome changes replace `setState` calls with an equivalent wrapper and remove an unused selection subtitle; the saved-account test changes are test setup. Localization changes its delegate to synchronous loading. None changes the wired behavior.
