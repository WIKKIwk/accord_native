import ExpoModulesCore
import ExpoUI
import SwiftUI

final class AccordListScrollReaderProps: UIBaseViewProps {
  @Field var targetID: String = ""
}

struct AccordListScrollReaderView: ExpoSwiftUI.View {
  @ObservedObject var props: AccordListScrollReaderProps

  var body: some View {
    AccordListScrollContent(targetID: props.targetID) {
      Children()
    }
  }
}

public class AccordListScrollModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AccordListScroll")
    Constant("supportsListScroll") { true }
    ExpoUIView(AccordListScrollReaderView.self)
  }
}
