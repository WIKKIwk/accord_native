type Touch = { identifier: number | string; pageY: number };

/** The source's local TwoPaneTransfer ratio; it grants no order or transfer authority. */
export class AdminWorkMapMoveSplit {
  private ratio = 0.5;
  private height = 0;
  private points = new Map<number | string, number>();
  private listeners = new Set<() => void>();
  getSnapshot = () => this.ratio;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  setHeight(value: number) { this.height = Number.isFinite(value) ? value : 0; }
  start(touches: readonly Touch[]) {
    for (const touch of touches) if (Number.isFinite(touch.pageY)) this.points.set(touch.identifier, touch.pageY);
  }
  move(touches: readonly Touch[]) {
    let next = this.ratio;
    for (const touch of touches) {
      if (!Number.isFinite(touch.pageY)) { this.points.delete(touch.identifier); continue; }
      const previous = this.points.get(touch.identifier);
      if (previous == null) continue;
      this.points.set(touch.identifier, touch.pageY);
      if (this.height > 0) next = Math.max(0.24, Math.min(0.76, next + (touch.pageY - previous) / this.height));
    }
    if (next !== this.ratio) { this.ratio = next; this.listeners.forEach(listener => listener()); }
  }
  end(touches: readonly Touch[]) { for (const touch of touches) this.points.delete(touch.identifier); }
  flex() { const top = Math.round(this.ratio * 1000); return { top, bottom: 1000 - top }; }
}
