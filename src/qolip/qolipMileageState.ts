import type { Session } from '../auth';
import { qolipMileage, type QolipMileage } from './qolipReworkApi';

type State = { loading: boolean; error: boolean; mileage: QolipMileage | null };
/** Mileage sheet loading and retry state; the native sheet remains unwired. */
export class QolipMileageState {
  private value: State = { loading: true, error: false, mileage: null };
  private active = true;
  private generation = 0;
  private readonly listeners = new Set<() => void>();
  constructor(private readonly read: () => Promise<QolipMileage>) {}
  static forSession(session: Session, code: string) { return new QolipMileageState(() => qolipMileage(session, code)); }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.value;
  private update(patch: Partial<State>) {
    if (!this.active) return;
    this.value = { ...this.value, ...patch }; this.listeners.forEach(listener => listener());
  }
  activate() { this.active = true; }
  async load(): Promise<void> {
    if (!this.active) return;
    const generation = ++this.generation; this.update({ loading: true, error: false });
    try {
      const mileage = await this.read();
      if (this.active && generation === this.generation) this.update({ mileage, loading: false });
    } catch (error) {
      if (this.active && generation === this.generation) this.update({ mileage: null, error: true, loading: false });
      throw error;
    }
  }
  dispose() { this.active = false; this.generation++; this.listeners.clear(); }
}
