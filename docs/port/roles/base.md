# Base UI contract

Baseline: `7c87a54e`. V2 paths below are relative to `../accord_mobile_v2/lib/src/`.
This is a behavior contract for the later iOS and Android screen sessions. A hook is marked pending where no V4 hook supplies the complete behavior. `src/shared/appRoutes.ts` supplies V2 home-route and capability decisions; `src/shared/loginLogic.ts` supplies the initial refresh and login-code keyboard rule. No reviewed screen explicitly requests haptic feedback; retain any feedback supplied by the platform controls.

## App entry

- V2 `AppEntryScreen`, `features/auth/presentation/app_entry_screen.dart`; root entry `/`. Hook: `bootstrapSession`, `loadSession`; saved-account selection hook pending.
- Initial loading waits for local initialization. With a saved session, refresh the profile for up to two seconds, retaining the local session on a transient failure; if still logged in, clear the navigation stack and open `homeRoute`. Test mode skips refresh. Preview credentials have a separate six-second attempt when configured.
- Without a session, show the current endpoint's saved accounts when any exist; otherwise show welcome. If a formerly active session is lost during refresh, show saved accounts or login. Add account opens login; back from login returns to saved accounts or welcome. Account selection opens the selected account home after successful switch.
- Loading is the only pending state; failed refresh does not show a blocking error. Entry itself has no localized text, refresh gesture, or explicit haptic.

## Saved-account chooser

- V2 `AccountSwitcherSheet`, `features/auth/presentation/account_switcher_sheet.dart`; used by app entry and `showAccountSwitcherSheet` from `account_switcher_launcher.dart` when the saved-account runtime is initialized and the endpoint has accounts. Logic: `createRuntimeAccountSwitchController`, `SwitchPinStore`; view hook pending.
- Show endpoint-filtered accounts in saved-store order. Active account is marked and selecting it does nothing. Disable account selection, add, and PIN back while busy. Selecting a different account without a profile-switch PIN calls `switchTo`; with a PIN, show PIN entry first. An app-lock PIN alone does not protect switching.
- Wrong PIN clears the entry and shows `pinWrong`; failed switch shows `accountSwitchFailed` and restores enabled state. Correct PIN switches, closes the chooser, clears the root stack and opens the new `homeRoute`. Add opens login in add-account mode; back from the PIN panel returns to the list unless busy. Sheet dismissal returns to its caller. No pull refresh.
- Text keys: `accountSwitchTitle`, `accountCurrent`, `accountAdd`, `accountPinPrompt(name)`, `pinWrong`, `accountSwitchFailed`, `checking`, `unlock`.

## Welcome and selection sheets

- V2 `WelcomeScreen`, `_SelectionSheet`, `features/auth/presentation/welcome_screen.dart`, `welcome_screen__WelcomeScreenState_methods_01.dart`, `welcome_screen_widgets_part_04.dart`. `LocaleController` and `ThemeController` persist choices; view hook pending. Test-mode behavior is deferred per D3.
- `getStarted` opens login. Language opens a sheet containing Uzbek, English, Russian and Urdu (Pakistan); choosing a language persists it, closes the sheet and stops automatic headline-language cycling. Theme opens a sheet containing kalmar, classic, moss, lavender, bliss and white; choosing persists the variant. Its mode control changes light/dark. The hidden test-mode confirmation uses the literal Uzbek text in V2. Dismiss/back without selection leaves the selection unchanged.
- States: no explicit language selected cycles headline languages; explicit selection pins it. The selected choice is marked current. No network loading, refresh, or explicit haptic.
- Text keys: `welcomeToAccord`, `getStarted`, `languageTitle`, `languageUnselected`, `uzbek`, `english`, `russian`, `accountCurrent`, `themeTitle`, `themeKalmarLabel`, `themeClassicLabel`, `themeMossLabel`, `themeLavenderLabel`, `themeBlissLabel`, `themeWhiteLabel`; Urdu label is the literal `اردو (پاکستان)`.

## Login

- V2 `LoginScreen`, `features/auth/presentation/login_screen.dart`, `login_screen_helpers_part_01.dart`, `login_screen__LoginScreenState_methods_01.dart`. Existing V4 `login`, `loginCodeUsesNumericKeyboard` and `loginFailureMessage` supply part of the logic; the platform view needs reconciliation.
- Phone and code are trimmed before submit. Empty input shows `loginRequiredFields`. While loading, submit is disabled and progress shown. Ordinary login calls `login`; add-account mode authenticates and calls `addAndSwitch`; success unlocks security and replaces the root stack with `homeRoute`. The test-mode branch is deferred. A network client/timeout failure shows `loginConnectionFailed`; a rejected or other login shows `loginFailed`; both retain editable inputs and allow retry.
- The code keyboard is numeric until two characters exist, then numeric for prefixes `40`, `50`, `80`, `92`; otherwise use the ordinary text keyboard. Back returns to the caller when supplied; V2 also recognizes the horizontal back swipe. No pull refresh.
- Text keys: `signInTitle`, `addProfileTitle`, `phoneLabel`, `codeLabel`, `loginAction`, `accountAdd`, `loginRequiredFields`, `loginConnectionFailed`, `loginFailed`.

## Profile and profile editor

- V2 `ProfileScreen`, `_ProfileSelectionSheet`, `features/shared/presentation/profile_screen.dart`, `profile_screen_widgets_part_01.dart`, `profile_screen_widgets_part_03.dart`, and `profile_screen__ProfileScreenState_methods_01.dart`. Existing `profile`, `updateNickname`, `uploadAvatar` are shared APIs; a complete profile/editor hook is pending.
- Load cached avatar after entering. Pull-to-refresh and app resume fetch the profile and refresh its avatar, falling back to cached avatar. The role/home route determines the shell and navigation. The `werka` display/legal name is displayed as `Wmanager` when equal to `werka` ignoring case.
- Open editor with current trimmed nickname and previous pending avatar. Image picker requests gallery image at maximum 1000×1000 and quality 82; cancel changes nothing, failure shows `imagePickFailed`. Dismissing the editor restores previous pending image. Saving keeps the old nickname if the trimmed text is empty, then saves a changed nickname and any pending avatar sequentially. Busy flags cover each request; failures show `nicknameSaveFailed` or `imageSaveFailed`. A successful avatar save refreshes or writes cache and clears pending image. Profile navigation/back follows its current role shell. No explicit haptic.
- Text keys: `profileTitle`, `adminAccount`, `capabilityBasedAccount`, `customerAccount`, `supplierAccount`, `werkaAccount`, `profileEditTitle`, `profileEditBody`, `nicknameLabel`, `nicknameHint`, `nicknameSaveFailed`, `profilePhotoTitle`, `chooseImage`, `changeImage`, `selectedImageNotice`, `imagePickFailed`, `imageSaveFailed`, `save`, `profileAvatarZoomLabel`. Several role subtitles in V2 are literal Uzbek strings.

## Profile settings and nested selections

- V2 `_ProfileSettingsSheet`, `_ProfileSelectionSheet`, `features/shared/presentation/profile_screen_widgets_part_02.dart`, `profile_screen_widgets_part_03.dart`, `profile_screen_declarations_part_04.dart`, `profile_screen__ProfileScreenState_methods_02.dart`. `ThemeController`, existing app-lock and `SwitchPinStore` supply parts; platform settings hook pending.
- Language, theme mode and theme variant controls update their respective persisted preferences. Manual update opens the update-check dialog. Disconnect closes settings before opening the disconnect confirmation. Outside/back dismisses the sheet; choosing a nested option returns to settings. No pull refresh.
- App-lock PIN: set/change opens PIN entry; removal is available only when a PIN exists; disable actions while saving. After successful setup, offer biometric enable only if supported and not already enabled. Biometrics are interactive only when a PIN exists and no biometric operation is running. Separate switch PIN has set/change/remove actions and its own busy state; it does not replace app-lock PIN. Saving/removal and biometric failures display their corresponding keys.
- Text keys: `profileSettingsTitle`, `profileSettingsBody`, `languageTitle`, `languageBody`, `uzbek`, `english`, `russian`, `themeModeTitle`, `themeModeBody`, `themeTitle`, `themeBody`, `themeKalmarLabel`, `themeClassicLabel`, `themeMossLabel`, `themeLavenderLabel`, `themeBlissLabel`, `themeWhiteLabel`, `appUpdateSettingsTitle`, `appUpdateSettingsBody`, `securityTitle`, `appLockPinTitle`, `appLockPinBody`, `pinSaving`, `pinChange`, `pinSet`, `pinRemove`, `pinRemoveFailed`, `pinSaveFailed`, `biometricEnableTitle`, `biometricEnabledBody`, `biometricDisabledBody`, `biometricQuickUnlockTitle`, `biometricQuickUnlockPrompt`, `biometricEnableFailed`, `biometricDisableFailed`, `switchPinTitle`, `switchPinBody`, `switchPinSet`, `switchPinChange`, `switchPinRemove`, `disconnectSessionTitle`, `disconnectSessionBody`, `yes`, `no`.

## PIN entry and confirmation

- V2 `PinSetupEntryScreen` and `PinSetupConfirmScreen`, `features/shared/presentation/pin_setup_entry_screen.dart`, `pin_setup_confirm_screen.dart`, `widgets/pin_entry_scaffold.dart`; routes `pinSetupEntry` and `pinSetupConfirm`. Security storage exists in `appLock` and `SwitchPinStore`; platform route/view hooks are pending.
- Entry takes app-lock or profile-switch purpose. Only a trimmed four-character value advances to confirmation with the first PIN and purpose. If confirmation returns true, return true; otherwise clear the entry. Back returns without success.
- Confirmation ignores repeat submit while saving. A mismatch clears input and displays `pinMismatch`; matching saves the appropriate account PIN and returns true. A failed save clears input and displays `pinSaveFailed`; saving state disables the action. Back follows the navigator, subject to busy state in the PIN control. No pull refresh.
- Text keys: `pinEnterTitle`, `switchPinEnterTitle`, `nextItemAction`, `pinRepeatTitle`, `switchPinRepeatTitle`, `pinMismatch`, `pinSaveFailed`, `save`; busy label in the shared scaffold is the literal `Tekshirilmoqda...`.

## Update check and install dialogs

- V2 `_AppUpdateCheckDialog` and `_AppUpdateDialog`, `core/update/app_update_check_dialog.dart`, `core/update/app_update_runtime.dart`. `AppUpdateManifest`, version policy, update service and coordinator are shared; native installer adapters and platform dialog hooks remain pending.
- Manual check opens a non-barrier-dismissible root dialog and starts refresh. Show checking, current version, unsupported, available, preparing/download progress or error. Error offers retry; close dismisses the check. If an update becomes ready, show the install dialog.
- Ready update shows current/latest version, required/optional copy, file size and release notes. Install is disabled while launching; the result distinguishes installer launched from install-permission required, and errors stay in the dialog. Optional updates offer later/back; mandatory updates cannot be dismissed with back. Resume refreshes the update state; removing the ready artifact closes the dialog. The native Android installer bridge is pending.
- Text keys: `appUpdateSettingsTitle`, `appUpdateCurrentTitle`, `appUpdateAvailableTitle`, `appUpdateBackgroundHint`, `appUpdateCheckRetryHint`, `appUpdateCurrent`, `appUpdateUnsupported`, `appUpdateInstalledVersion`, `appUpdateLatestVersion`, `checking`, `retry`, `closeAction`, `appUpdateRequiredTitle`, `appUpdateRequiredBody(version)`, `appUpdateAvailableBody(version)`, `appUpdateFileSize`, `appUpdateReleaseNotes`, `appUpdateLater`, `appUpdateAction`, `appUpdateOpenInstaller`, `appUpdateInstallerLaunched`, `appUpdateInstallPermission`, `appUpdateDownloadFailed`.
