import Foundation

@MainActor protocol ScaffoldTransformNode: AnyObject {
  var identity: AnyObject { get }; var untransformed: Bool { get }; var parent: ScaffoldTransformNode? { get }
}
/** Window-unit rectangles can be painted as local RN units only along this supported identity transform path. */
@MainActor enum ScaffoldLayoutTransforms {
  static func supported(_ marker: ScaffoldTransformNode?, _ originalRoot: AnyObject?) -> Bool {
    guard let originalRoot else { return false }; var visited: Set<ObjectIdentifier> = []; var cursor = marker
    while let node = cursor {
      guard visited.insert(ObjectIdentifier(node.identity)).inserted, node.untransformed else { return false }
      if node.identity === originalRoot { return true }; cursor = node.parent
    }
    return false
  }
}
