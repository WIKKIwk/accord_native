# base-wire

Status: in progress
Stopped at: wire account entry, profile, security, appearance and updates.

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| Push token reader | `FirebaseClientBootstrap`, `PushMessagingService` | Firebase configuration and a native FCM token reader remain outside this wire session. |
| Native APK installer | `NativeAppUpdatePlatform` | The native Android installer remains outside this wire session. |

## Deviations candidates

## Test mode pending

Login test mode remains deferred under D3.

## Needs from the integrator

## Drift

V2 baseline `7c87a54e` to `f11910bb`: the login/welcome changes replace `setState` calls with an equivalent wrapper and remove an unused selection subtitle; the saved-account test changes are test setup. No wire behavior changed in these hunks. Localization drift needs a separate review.
