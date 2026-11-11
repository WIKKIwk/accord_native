import SwiftUI

// Compile the real bridge content against SwiftUI, including the List row's
// swipe action, without a simulator, device or native app build.
struct AccordListScrollTypecheck: View {
  var body: some View {
    AccordListScrollContent(targetID: "camera") {
      List {
        Text("Camera").id("camera")
        Text("WIP").swipeActions {
          Button("Remove", role: .destructive) {}
        }
      }
    }
  }
}
