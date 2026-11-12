# Aparatchi iOS completed WIP sheets

Completed on `main`, as requested by the user.

## Changes

- Completed-order WIP history uses the native large sheet detent. Its list fills the available sheet viewport, can shrink above the footer and disables inherited automatic navigation insets.
- QR search uses the existing full-width, large native iOS order button, including its scanner icon and original disabled/search behavior.
- WIP detail and reactivation-menu sheets use the iOS `useWorkerWipSheet` presenter inside the parent sheet. Pushing a root route from the presented SwiftUI history was dismissing its presenter. The SDK documents nesting child sheets inside their parent's content: https://docs.expo.dev/versions/v58.0.0/sdk/ui/swift-ui/bottomsheet/.
- The presenter retains synchronous duplicate-open protection, waits for native dismissal before a menu-to-details handoff and ignores retired callbacks after unmount or a newer presentation.
- The default platform implementation delegates to the existing native route presenter, retaining Android's presentation flow.

## Verification

- 80/80 focused WIP history, reactivation, detail, order-sheet and daily-work surface tests passed.
- Integration fixtures exercise tap and long press with the actual inline iOS presenter, including dismissal back to the retained list without another history read.
- Tests cover small/tall viewport detents, QR button/viewport configuration, early close, repeated gestures, menu handoff and retired dismissal callbacks.
- iOS and Android TypeScript projects passed.
- Project lint passed with its existing `AdminClosedHistoryOwner.tsx` dependency warning (0 errors).
- iOS Hermes export passed: `.expo/worker-wip-history-ios`.
- No simulator was booted. Native pixel measurements and physical-device interaction were not verified; lifecycle and view-configuration checks use mocks.
