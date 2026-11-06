# base-android

Status: in progress
Stopped at: shared profile and security hooks needed for the remaining parity gaps

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| Android settings | `_ProfileSettingsSheet` | The manual update action and install dialogs need a configured update coordinator, presenter and Android installer adapter. |

## Deviations candidates

## Test mode pending

| Where | V2 reference | What is needed |
|---|---|---|
| Android login | `LoginScreen.submitLogin` | Test-mode login remains deferred by D3. |

## Needs from the integrator

| Where | V2 reference | What is needed |
|---|---|---|
| Profile avatar cache | `ProfileAvatarCache`, `ProfileScreen._refreshProfile` | Implement cached-byte fallback when an avatar refresh or post-upload download fails; validate picker compression and image behavior on a device. |
| `src/components/AppSettings.tsx`, app theme/localization integration | `_LanguagePreferenceRow`, `_ThemePreferenceRow`, `_ThemeIconToggle` | Apply the persisted theme variant and saved V2 theme mode throughout the app and subscribe the other shared screens to locale changes. Android settings persists the choices, but the existing global appearance provider uses a separate preference and does not apply variants. |
| `src/shared/appUpdateRuntime.ts` and native installer | `_AppUpdateCheckDialog`, `_AppUpdateDialog` | Expose an initialized coordinator/presenter and Android installation adapter to settings. |

## Validation

- All 742 project tests, Expo lint, the default type-check and the iOS type-check pass. Android type-check reports the same 10 pre-existing worker errors; no new errors were added.
- Focused checks cover login helpers, settings selections, biometric busy/offer behavior, disconnect ordering and avatar preview gestures.
- Not run on a device. Check light and dark mode, keyboard changes, profile editing, avatar zoom, settings selections, biometrics and the hardware back button on an Android phone.
