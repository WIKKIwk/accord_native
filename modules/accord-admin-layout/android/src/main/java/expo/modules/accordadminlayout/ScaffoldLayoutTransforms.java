package expo.modules.accordadminlayout;

import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.Set;

/** Window origin plus untransformed width/height is valid only along an entirely identity transform path. */
public final class ScaffoldLayoutTransforms {
  private ScaffoldLayoutTransforms() {}
  public interface Node { Object identity(); boolean untransformed(); Node parent(); }
  public static boolean supported(Node marker, Object originalRoot) {
    if (marker == null || originalRoot == null) return false;
    Set<Object> visited = Collections.newSetFromMap(new IdentityHashMap<>());
    for (Node cursor = marker; cursor != null; cursor = cursor.parent()) {
      Object identity = cursor.identity();
      if (identity == null || !visited.add(identity) || !cursor.untransformed()) return false;
      if (identity == originalRoot) return true;
    }
    return false;
  }
}
