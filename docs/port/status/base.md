# base

Status: parts 1 and 2 in progress
Stopped at: shared API and base logic comparison

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| Push token reader | `PushMessagingService.unregisterCurrentToken`, `logout` | Initialize Firebase Messaging on each native platform and register its FCM token reader. Firebase configuration must be supplied by the user. Logout otherwise remains ported. |

## Deviations candidates

## Test mode pending

## Needs from the integrator

| Where | V2 reference | What is needed |
|---|---|---|
| `src/app/android-worker/` | `AppSession.homeRoute` | Add the Android worker Expo Router route. Until then the existing Android worker screen renders at the root; base cannot create route files outside its scope. |
