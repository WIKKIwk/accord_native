# profile-daily

Status: optional shared Profile action prepared; role wiring and real-phone checks remain open.

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| Boyoqchi Profile | `profile_screen.dart`, `boyoqchi_navigation_drawer.dart` | The Boyoqchi role should reuse Profile without passing `onDailyWork`; its current placeholder Home callback is not the V2 Profile action. Check the result on iOS and Android phones. |
| Other new roles | `profile_screen.dart` | Compare each role's Profile entry against V2 before deciding whether to supply the optional callback. Existing Worker and Preparation callers must retain their present behavior. |

## Checkpoint

`ProfileScreen` and its platform views now accept an optional `onDailyWork` callback. When omitted, the corresponding row is absent; no no-op callback is required. All existing callers still pass the same callback. Worker retains the row and action; Preparation retains its existing platform-specific behavior (hidden on Android, visible on iOS). No Worker or Preparation call site or source was changed.

Mocked component-render tests exercise the actual iOS, Android and fallback views, the callback action, the Preparation default and propagation through `ProfileScreen`. These tests do not replace native phone testing.

## Verification

- Eight focused Profile action/propagation cases and three existing Preparation Profile/theme cases passed.
- The full Node suite had 1,186 passes and the same six pre-existing Preparation Android ESM-import failures. iOS TypeScript, uncached Expo lint and the ledger check passed; Android retained the same nine pre-existing Worker errors.
- Offline iOS and Android JavaScript exports passed with bytecode disabled. They are not native builds or device tests.
