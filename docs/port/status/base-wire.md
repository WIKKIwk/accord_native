# base-wire

Status: in progress
Stopped at: finish security lifecycle and final verification.

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| Push token reader | `FirebaseClientBootstrap`, `PushMessagingService` | Firebase configuration and a native FCM token reader remain outside this wire session. |
| Native APK installer | `NativeAppUpdatePlatform` | Android download, signature validation and install adapters are not present. Automatic preparation and installation remain disabled until the real bridge is integrated. |
| Native application metadata | `NativeAppUpdatePlatform.currentAppInfo` | The check reads the real `ExpoApplication` native module when present and otherwise reports that app information is unavailable. This worktree does not include `expo-application`; its dependency and a rebuilt app are needed for reliable manual checks. |
| Login and account entry | `LoginScreen`, `AppEntryScreen`, `AccountSwitcherSheet` | Verify keyboard, login back swipe, saved-account PIN and unlock-after-login on real iOS and Android devices. |
| In-session account switch launcher | `showAccountSwitcherSheet`, `app_shell_helpers_part_01.dart` | The V2 launcher is on the worker-owned profile button; connect it in the aparatchi session. |
| Standalone PIN routes | `PinSetupEntryScreen`, `PinSetupConfirmScreen` | Settings now use the entry and confirmation flows for both PIN purposes, but other callers need Expo Router route files. The wire session may edit only `src/app/index.tsx` and `src/app/_layout.tsx`. |
| Avatar device behavior | `ProfileAvatarCache`, `ProfileScreen._pickAvatar` | Validate image picking, compression and cached image rendering on a real phone. |
| Role-owned theme and locale surfaces | `ThemeController`, `LocaleController` | Base native hosts use the persisted theme and RTL, but worker and other role-owned hosts still need to adopt the shared palette/direction and translate their own hard-coded text. Verify the base surfaces on devices. |
| Security lifecycle device behavior | `SecurityController.didChangeAppLifecycleState`, `unlockWithBiometric` | Privacy shielding, resume locking and biometric resume suppression have focused tests; verify them on real iOS and Android devices. |

## Deviations candidates

## Test mode pending

Login test mode remains deferred under D3.

## Needs from the integrator

| Where | V2 reference | What is needed |
|---|---|---|
| `package.json`, `package-lock.json` | `NativeAppUpdatePlatform.currentAppInfo` | Install the SDK-compatible `expo-application` with `npx expo install expo-application`, rebuild the app and connect its public API. These files are outside the base-wire fence. |
| Native Android update module | `accord/app_update` | Supply the V2 download, validation and installation bridge, then connect the automatic update runtime. |

## Drift

V2 baseline `7c87a54e` to `f11910bb`: the login/welcome changes replace `setState` calls with an equivalent wrapper and remove an unused selection subtitle; the saved-account test changes are test setup. Localization changes its delegate to synchronous loading. None changes the wired behavior.
