# nav-badge

Status: shared optional Android dock badge prepared; phone verification remains open.

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| Android role dock | `RoleDock`, unread notification and Chat indicators | Verify the native dot, accessibility and tab interactions on a real Android phone once a role opts in. No device was used. |

## Checkpoint

The shared `RoleBottomBar` reuses the Customer checkpoint `a001d4e` without modification. `showBadge` is optional; existing worker and preparation call sites do not set it. Focused tests cover the existing no-badge output, labels and interaction and the opt-in dot. SDK 58 documents `Badge` and `BadgedBox` at https://docs.expo.dev/versions/v58.0.0/sdk/ui/jetpack-compose/badgedbox/.

No worker or preparation source files were changed. The badge is a shared building block, not a claim that any role or its unread runtime is complete.

## Verification

- Both focused badge tests passed. The full Node suite had 1,167 passes and the same six pre-existing preparation Android ESM import failures.
- iOS TypeScript, uncached Expo lint and the ledger check passed. Android TypeScript retained the nine pre-existing worker errors.
- Offline iOS and Android JavaScript exports passed with bytecode disabled. These are not native builds or device tests.
