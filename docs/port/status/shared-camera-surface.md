# shared-camera-surface

Status: an unconnected shared camera surface and permission controller are prepared for role-specific scanners.

## Open items

| Where | What is needed |
|---|---|
| Role wiring | No role uses this surface yet. A role must supply a pure synchronous guard reading its live session, focus, foreground and permission state, increment its session key on policy changes, and check again after every awaited permission or scan action. Parsing, deduplication, retry, manual entry and navigation remain role-specific. |
| Camera ownership | The permission queue serializes only callers of this new module. Existing Worker/Preparation camera hooks do not participate. The controller is not a camera-ownership mutex; two active owners and native release ordering require separate handling. |
| Permission and native release | An in-flight OS prompt cannot be cancelled by this code. If it never settles, later queued operations wait. Unmounting `CameraView` on inactive does not prove that the native camera has physically released. |
| Device parity | Native iOS/Android permissions, torch availability, lifecycle, event timing, focus, zoom, scan window, barcode geometry and accessibility require real-device verification. No role route is enabled by this checkpoint. |

## Checkpoint

The surface wraps the existing Expo `CameraView`, preserving the original event object without parsing, and unmounts it when inactive, checking permission or not granted. Configuration and session changes invalidate old JavaScript generations; synchronous role authorization and a second generation/callback check reject the mocked reentrant race. Permission reads and requests through this module are serialized, stale grants are cleared while checking, and a disposed owner cannot start a queued prompt. An already-open OS prompt is not claimed to be cancelled.

This adds no Worker/Preparation edits, no automatic permission request and no role route. The small synchronous guard is reusable but does not replace a role's own live identity and scope checks.

## Verification

- Twenty-four focused mocked camera and permission cases passed, including independently reproduced and retested reentrant event, cross-owner prompt and stale-grant cases. No real camera, OS permission or device was used.
- The integration branch passed iOS TypeScript, lint, ledger and both offline Expo JavaScript exports. The full Node suite had 1,258 passes and the same six pre-existing Preparation Android extensionless ESM failures; Android TypeScript had the same nine pre-existing Worker errors. These are not native builds or phone tests.
