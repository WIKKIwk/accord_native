# base-android

Status: in progress
Stopped at: profile, settings and PIN reconciliation

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| Android login | `LoginScreen` | The numeric-prefix input formatter and IME submit need the shared login view hook; the current screen keeps the existing submit guard. |

## Deviations candidates

## Test mode pending

| Where | V2 reference | What is needed |
|---|---|---|
| Android login | `LoginScreen.submitLogin` | Test-mode login remains deferred by D3. |

## Needs from the integrator

| Where | V2 reference | What is needed |
|---|---|---|
| `src/shared/loginLogic.ts`, `src/auth.ts` | `LoginScreen.submitLogin` | Supply a shared login view hook that validates and trims both inputs before authentication, handles IME submission and numeric-prefix filtering, and exposes busy/error state. `login` currently sends untrimmed arguments to `authenticateAccount`. |
| `src/app/index.tsx` | `AppEntryScreen`, `LoginScreen` | Connect the welcome/saved-account caller, add-account mode, back/swipe navigation and unlock-after-login behavior. |
