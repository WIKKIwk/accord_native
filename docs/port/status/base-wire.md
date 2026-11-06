# base-wire

Status: in progress
Stopped at: integrator handoff for the listed native and role-owned work.

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| Push token reader | `FirebaseClientBootstrap`, `PushMessagingService` | Firebase configuration and a native FCM token reader remain outside this wire session. |
| Native APK installer | `NativeAppUpdatePlatform` | Android download, signature validation and install adapters are not present. Automatic preparation and installation remain disabled until the real bridge is integrated. |
| Native application metadata | `NativeAppUpdatePlatform.currentAppInfo` | The check reads the real `ExpoApplication` native module when present and otherwise reports that app information is unavailable. This worktree does not include `expo-application`; its dependency and a rebuilt app are needed for reliable manual checks. |
| Update dialogs | `_AppUpdateCheckDialog`, `_AppUpdateDialog` | The manual presenter is connected, but both generated surface boxes remain unchecked until real native metadata, Android preparation/installation and device behavior are integrated. |
| Login and account entry | `LoginScreen`, `AppEntryScreen`, `AccountSwitcherSheet` | Verify keyboard, login back swipe, saved-account PIN and unlock-after-login on real iOS and Android devices. |
| In-session account switch launcher | `showAccountSwitcherSheet`, `app_shell_helpers_part_01.dart` | The V2 launcher is on the worker-owned profile button; connect it in the aparatchi session. |
| Standalone PIN routes | `PinSetupEntryScreen`, `PinSetupConfirmScreen` | Settings now use the entry and confirmation flows for both PIN purposes, but other callers need Expo Router route files. The wire session may edit only `src/app/index.tsx` and `src/app/_layout.tsx`. |
| Avatar device behavior | `ProfileAvatarCache`, `ProfileScreen._pickAvatar` | Validate image picking, compression and cached image rendering on a real phone. |
| Role-owned theme and locale surfaces | `ThemeController`, `LocaleController` | Base native hosts use the persisted theme and RTL, but worker and other role-owned hosts still need to adopt the shared palette/direction and translate their own hard-coded text. Verify the base surfaces on devices. |
| Security lifecycle device behavior | `SecurityController.didChangeAppLifecycleState`, `unlockWithBiometric` | Privacy shielding, resume locking and biometric resume suppression have focused tests; verify them on real iOS and Android devices. |

## Deviations candidates

## Test mode pending

Login test mode remains deferred under D3.

## Test coverage notes

- Existing login, PIN settings, nickname and avatar tests were updated where they expected untrimmed login input, an old-PIN challenge, implicit removal by Done, extra response/size validation or an invented avatar endpoint; V2 does not have those behaviors.
- V2 has no recorded HTTP tests for `updateNickname` or `uploadAvatar`; their shared request tests and the avatar URL/cache tests follow the baseline source.

## Needs from the integrator

| Where | V2 reference | What is needed |
|---|---|---|
| `package.json`, `package-lock.json` | `NativeAppUpdatePlatform.currentAppInfo` | Install the SDK-compatible `expo-application` with `npx expo install expo-application`, rebuild the app and connect its public API. These files are outside the base-wire fence. |
| Native Android update module | `accord/app_update` | Supply the V2 download, validation and installation bridge, then connect the automatic update runtime. |
| `src/app/pin-setup-entry.tsx`, `src/app/pin-setup-confirm.tsx` | `PinSetupEntryScreen`, `PinSetupConfirmScreen` | Add the standalone routes using the shared PIN flow; only the root entry and layout routes are inside the base-wire fence. |
| Worker profile launcher and other role-owned hosts | `showAccountSwitcherSheet`, `ThemeController`, `LocaleController` | Connect the in-session chooser and adopt the shared palette and direction in the owning role sessions. |
| `src/chatModel.ts` | `ProfileAvatarCache.refreshFromUrl` | Chat still constructs `/v1/mobile/profile/avatar/view`; profile now uses the URL returned by the server. Review the chat-owned path in the chat session. |

## Drift

V2 baseline `7c87a54e` to `f11910bb`: the login/welcome changes replace `setState` calls with an equivalent wrapper and remove an unused selection subtitle; the saved-account test changes are test setup. Localization changes its delegate to synchronous loading. None changes the wired behavior.

## Verification and handoff

- Source reading was limited to the wire rows and their V2 references; the exact token count was not measured. The generated base lists estimate 178k and 48k tokens for the full base role, not the amount read in this wire session.
- The preceding base status reported 31 of 32 public API entries tagged and 742 tests passing; those starting counts were not independently remeasured. The API ledger remains 31 of 32 because Firebase logout is open. This session connected the existing `login`, `profile`, `updateNickname` and `uploadAvatar` methods and added no endpoint family.
- The complete Node suite passed 830/830. Default and iOS TypeScript and Expo lint passed. Android TypeScript still reports the same 10 worker errors documented in `PORT.md`; no new Android errors appeared.
- Ledger check passed with six endpoint warnings. The profile avatar warning now belongs to `src/chatModel.ts`; the other warnings concern chat, preparation and dynamically assembled push/rezka paths. Both base role reports regenerated; entry, login, welcome, profile and selection surfaces are tagged, while the PIN routes and update dialogs remain unchecked.
- No simulator, emulator or physical device was used. The device checks and out-of-scope integration work are listed above.

### Checkpoint commits

```text
9af8e21 port(base-wire/1): shared login form, 2 methods
8bb659a port(base-wire/1): saved account entry, 3 methods
f78bc1c port(base-wire/1): PIN settings flow, 4 methods
42fb9df port(base-wire/1): profile editing, 5 methods
fe6d777 port(base-wire/1): profile avatar cache, 4 methods
40849e2 port(base-wire/1): base appearance and locale, 3 methods
427f04c port(base-wire/1): manual update check, 2 methods
085ca1c port(base-wire/1): security lifecycle, 1 method
b9e8c07 port(base-wire/1): profile avatar URL, 1 method
7356193 port(base-wire/1): account chooser details, 2 methods
```
