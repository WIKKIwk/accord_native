import { useLayoutEffect, useRef, useState, type ComponentRef, type ReactNode, type RefObject } from 'react';
import { Pressable, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import type { useWorkerPaddonTransfer } from './useWorkerPaddonTransfer';
import type { WorkerPaddonBatch } from '../workerPaddonModel';

type Point = { x: number; y: number };
type Drag = { source: string; ids: string[]; permit(): boolean; point: Point };
type Model = ReturnType<typeof useWorkerPaddonTransfer>;
type NativeView = ComponentRef<typeof View>;
const bounds = (view: NativeView) => new Promise<{ x: number; y: number; width: number; height: number }>(resolve => view.measureInWindow((x, y, width, height) => resolve({ x, y, width, height })));

/** V2 long-press drag: selected movable batch, otherwise the one dragged WIP. */
export function useWorkerPaddonDrag(model: Model, root: RefObject<NativeView | null>) {
  const zones = useRef(new Map<string, NativeView>()), active = useRef<Drag | null>(null), latest = useRef(model);
  useLayoutEffect(() => { latest.current = model; }, [model]);
  const [drag, setDrag] = useState<Drag | null>(null), [origin, setOrigin] = useState({ x: 0, y: 0 });
  return { drag, origin,
    zone: (code: string, view: NativeView | null) => { if (view) zones.current.set(code, view); else zones.current.delete(code); },
    start(source: string, batch: WorkerPaddonBatch, point: Point) {
      const ids = latest.current.dragIds(source, batch); if (!ids.length) return;
      const next = { source, ids, point, permit: latest.current.controller.capture() }; active.current = next; setDrag(next);
      root.current?.measureInWindow((x, y) => setOrigin({ x, y }));
    },
    update(point: Point) { if (active.current) { active.current = { ...active.current, point }; setDrag(active.current); } },
    cancel() { active.current = null; setDrag(null); },
    async end(point: Point) {
      const payload = active.current; active.current = null; setDrag(null);
      if (!payload?.permit()) return;
      for (const [code, view] of zones.current) {
        if (code === payload.source) continue;
        const box = await bounds(view); if (!payload.permit()) return;
        if (point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height) {
          await latest.current.drop(payload.source, payload.ids); return;
        }
      }
    },
  };
}
export function WorkerPaddonDraggable({ drag, source, batch, enabled, onPress, children }: {
  drag: ReturnType<typeof useWorkerPaddonDrag>; source: string; batch: WorkerPaddonBatch; enabled: boolean; onPress(): void; children: ReactNode;
}) {
  const latest = useRef({ drag, source, batch, onPress }), suppressTap = useRef(false);
  useLayoutEffect(() => { latest.current = { drag, source, batch, onPress }; }, [drag, source, batch, onPress]);
  const gesture = usePanGesture({ enabled, activateAfterLongPress: 500, runOnJS: true,
    onActivate: event => { suppressTap.current = true; const { drag, source, batch } = latest.current; drag.start(source, batch, { x: event.absoluteX, y: event.absoluteY }); },
    onUpdate: event => latest.current.drag.update({ x: event.absoluteX, y: event.absoluteY }),
    onDeactivate: event => { if (!event.canceled) void latest.current.drag.end({ x: event.absoluteX, y: event.absoluteY }); },
    onFinalize: () => latest.current.drag.cancel(),
  });
  return <GestureDetector gesture={gesture}><Pressable disabled={!enabled} onPressIn={() => { suppressTap.current = false; }} onPress={() => { if (!suppressTap.current) latest.current.onPress(); }}>{children}</Pressable></GestureDetector>;
}
