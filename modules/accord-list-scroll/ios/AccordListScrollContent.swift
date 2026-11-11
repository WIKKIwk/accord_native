import SwiftUI

/// Keeps the child List (and its native swipe actions) intact.
struct AccordListScrollContent<Content: View>: View {
  let targetID: String
  @ViewBuilder let content: () -> Content

  var body: some View {
    ScrollViewReader { proxy in
      content()
        .task(id: targetID) {
          guard !targetID.isEmpty else { return }
          // React inserts the camera row in the same update. Use the proxy after
          // that update, never from ScrollViewReader's content builder.
          await Task.yield()
          guard !Task.isCancelled else { return }
          withAnimation(.timingCurve(0.215, 0.61, 0.355, 1, duration: 0.28)) {
            proxy.scrollTo(targetID, anchor: UnitPoint(x: 0.5, y: 0.08))
          }
        }
    }
  }
}
