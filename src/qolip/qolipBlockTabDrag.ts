import type { QolipHomeTab } from './qolipHomePresentation';

export type QolipTabLayout = { x: number; width: number };
export type QolipTabDrag = { key: string; centers: ReadonlyMap<string, number>; targetIndex: number };

/** V2 _QolipBlockTabBarState._targetIndexFor: thresholds use the frozen original centers. */
export function qolipTabDragTarget(tabs: readonly QolipHomeTab[], centers: ReadonlyMap<string, number>, globalX: number): number {
  if (!centers.size) return -1;
  let target = -1;
  tabs.forEach((tab, index) => { const center = centers.get(tab.key); if (center !== undefined && globalX >= center) target = index; });
  return target < 0 && tabs.length ? 0 : target;
}

export function startQolipTabDrag(tabs: readonly QolipHomeTab[], key: string,
  layouts: ReadonlyMap<string, QolipTabLayout>, absoluteX: number, localX: number): QolipTabDrag | null {
  const source = layouts.get(key), index = tabs.findIndex(tab => tab.key === key);
  if (!source || source.width <= 0 || index < 0) return null;
  // The gesture's local coordinate belongs to its tab. Include the current strip scroll offset.
  const origin = absoluteX - localX - source.x, centers = new Map<string, number>();
  tabs.forEach(tab => { const layout = layouts.get(tab.key); if (layout && layout.width > 0) centers.set(tab.key, origin + layout.x + layout.width / 2); });
  return { key, centers, targetIndex: index };
}

export function previewQolipTabDrag(tabs: readonly QolipHomeTab[], drag: QolipTabDrag | null): readonly QolipHomeTab[] {
  const oldIndex = drag ? tabs.findIndex(tab => tab.key === drag.key) : -1;
  if (!drag || oldIndex < 0 || drag.targetIndex < 0 || drag.targetIndex >= tabs.length) return tabs;
  const next = [...tabs], [moved] = next.splice(oldIndex, 1);
  next.splice(drag.targetIndex, 0, moved);
  return next;
}

export function finishQolipTabDrag(tabs: readonly QolipHomeTab[], drag: QolipTabDrag | null,
  globalX: number): { oldIndex: number; newIndex: number } | null {
  if (!drag) return null;
  const oldIndex = tabs.findIndex(tab => tab.key === drag.key), hit = qolipTabDragTarget(tabs, drag.centers, globalX);
  const newIndex = hit < 0 ? drag.targetIndex : hit;
  return oldIndex < 0 || newIndex < 0 || newIndex >= tabs.length || oldIndex === newIndex ? null : { oldIndex, newIndex };
}
