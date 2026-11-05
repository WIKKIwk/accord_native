# build

Status: in progress — iOS development build installed and launched alongside V2; Android and EAS distribution remain unverified.
Stopped at: have the account owner run the EAS steps in `docs/port/BUILD.md` and verify Android installation.

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| EAS distribution | Build session | The account owner must link EAS and provide signing credentials to build and distribute the app as described in `docs/port/BUILD.md`. |
| Local Android build | Build session | Android SDK and Android build tools are not installed on this Mac, so `expo run:android` could not run. |
| Android physical device | Build session goal | Build and install an Android APK after an Android toolchain or EAS account is available. |

iOS was built locally with an existing development identity and installed on an iPhone 11 Pro that already had V2. Both bundle identifiers were confirmed installed; V4 launched and loaded its JavaScript bundle from Metro. No Expo account command or EAS build was run.

Checks: the Node test suite, default and iOS typechecks, lint, both Expo Go bundles, the iOS native build and prebuild passed. Android typecheck reports the 10 existing errors documented in `PORT.md`. Expo Doctor reports the existing package mismatches below. Ledger check reports the five existing endpoint warnings in `PORT.md`; `role build 1` is unsupported because build is not a ledger role.

## Deviations candidates

None.

## Test mode pending

None.

## Needs from the integrator

| Where | What is needed |
|---|---|
| `package.json` | `expo-doctor` reports seven pre-existing SDK version mismatches: `react-native-safe-area-context` 5.10.1 vs ~5.11.1, `@expo/ui` 58.0.26 vs ~58.0.27, `expo` 58.0.22 vs ~58.0.23, `expo-constants` 58.0.14 vs ~58.0.15, `expo-linking` 58.0.15 vs ~58.0.16, `expo-router` 58.0.29 vs ~58.0.30, and `expo-splash-screen` 58.0.12 vs ~58.0.13. Coordinate compatible updates across sessions. |
