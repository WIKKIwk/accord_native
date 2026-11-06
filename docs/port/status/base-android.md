# base-android

Status: in progress
Stopped at: shared profile and security hooks needed for the remaining parity gaps

## Open items

| Where | V2 reference | What is needed |
|---|---|---|

## Deviations candidates

## Test mode pending

| Where | V2 reference | What is needed |
|---|---|---|
| Android login | `LoginScreen.submitLogin` | Test-mode login remains deferred by D3. |

## Needs from the integrator

| Where | V2 reference | What is needed |
|---|---|---|

## Validation

- All 742 project tests, Expo lint, the default type-check and the iOS type-check pass. Android type-check reports the same 10 pre-existing worker errors; no new errors were added.
- Focused checks cover login helpers, settings selections, biometric busy/offer behavior, disconnect ordering and avatar preview gestures.
- Not run on a device. Check light and dark mode, keyboard changes, profile editing, avatar zoom, settings selections, biometrics and the hardware back button on an Android phone.
