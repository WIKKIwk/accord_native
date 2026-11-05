# build

Status: in progress — build configuration prepared; physical installation and EAS account steps remain.
Stopped at: complete device verification and have the account owner run the EAS steps in `docs/port/BUILD.md`.

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| EAS and physical devices | Build session goal | The account owner must link EAS, supply signing credentials, build and install the app as described in `docs/port/BUILD.md`. |
| Local Android build | Build session | Android SDK and Android build tools are not installed on this Mac, so `expo run:android` could not run. |

## Deviations candidates

None.

## Test mode pending

None.

## Needs from the integrator

| Where | What is needed |
|---|---|
| `package.json` | `expo-doctor` reports seven pre-existing SDK version mismatches: `react-native-safe-area-context` 5.10.1 vs ~5.11.1, `@expo/ui` 58.0.26 vs ~58.0.27, `expo` 58.0.22 vs ~58.0.23, `expo-constants` 58.0.14 vs ~58.0.15, `expo-linking` 58.0.15 vs ~58.0.16, `expo-router` 58.0.29 vs ~58.0.30, and `expo-splash-screen` 58.0.12 vs ~58.0.13. Coordinate compatible updates across sessions. |
