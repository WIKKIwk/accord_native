import { useLayoutEffect, useRef, useState, type ComponentRef, type ReactNode, type RefObject } from 'react';
import { View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import type { QolipTransferProduct } from './qolipProductTransferState';
import type { useQolipProductTransfer } from './useQolipProductTransfer';
type Point = { x: number; y: number };
type NativeView = ComponentRef<typeof View>;
type Drag = { source: QolipTransferProduct; items: QolipTransferProduct[]; point: Point; permit(): boolean };
type Model = ReturnType<typeof useQolipProductTransfer>;
const normalized = (value: string) => value.trim().toLowerCase();
export function useQolipProductDrag(model: Model, root: RefObject<NativeView | null>) {
  const zones = useRef(new Map<'source' | 'target', NativeView>()), active = useRef<Drag | null>(null), latest = useRef(model);
  useLayoutEffect(() => { latest.current = model; }, [model]);
  const [drag, setDrag] = useState<Drag | null>(null), [origin, setOrigin] = useState<Point>({ x: 0, y: 0 });
  return { drag, origin,
    zone: (side: 'source' | 'target', view: NativeView | null) => { if (view) zones.current.set(side, view); else zones.current.delete(side); },
    start(source: QolipTransferProduct, item: QolipTransferProduct, point: Point) {
      const current = latest.current, items = current.controller.dragItems(item, source); if (!items.length) return;
      const payload = { source, items, point, permit: current.controller.current }; active.current = payload; setDrag(payload);
      root.current?.measureInWindow((x, y) => setOrigin({ x, y }));
    },
    update(point: Point) { if (active.current) { active.current = { ...active.current, point }; setDrag(active.current); } },
    cancel() { active.current = null; setDrag(null); },
    async end(point: Point) {
      const payload = active.current; active.current = null; setDrag(null);
      if (!payload?.permit()) return;
      for (const [side, view] of zones.current) {
        const target = latest.current[side]; if (!target || normalized(target.code) === normalized(payload.source.code)) continue;
        const box = await new Promise<{ x: number; y: number; width: number; height: number }>(resolve => view.measureInWindow((x, y, width, height) => resolve({ x, y, width, height })));
        if (!payload.permit()) return;
        if (point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height) {
          await latest.current.controller.move(payload.items.map(item => normalized(item.qolip_code)), payload.source, target); return;
        }
      }
    },
  };
}
export function QolipProductDragHandle({ drag, product, item, enabled, children }: {
  drag: ReturnType<typeof useQolipProductDrag>; product: QolipTransferProduct; item: QolipTransferProduct; enabled: boolean; children: ReactNode;
}) {
  const latest = useRef({ drag, product, item });
  useLayoutEffect(() => { latest.current = { drag, product, item }; }, [drag, product, item]);
  const gesture = usePanGesture({ enabled, activateAfterLongPress: 500, runOnJS: true,
    onActivate: event => { const value = latest.current; value.drag.start(value.product, value.item, { x: event.absoluteX, y: event.absoluteY }); },
    onUpdate: event => latest.current.drag.update({ x: event.absoluteX, y: event.absoluteY }),
    onDeactivate: event => { if (!event.canceled) void latest.current.drag.end({ x: event.absoluteX, y: event.absoluteY }); },
    onFinalize: () => latest.current.drag.cancel(),
  });
  return <GestureDetector gesture={gesture}><View style={{ width: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>{children}</View></GestureDetector>;
}
