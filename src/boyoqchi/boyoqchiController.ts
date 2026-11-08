import type { AdminApparatus } from '../apparatusApi';
import type { ReturnedPaintRequest, ReturnedPaintRequestPage } from './returnedPaintModel';
import { boyoqchiRequestKey } from './boyoqchiLogic';

export type BoyoqchiRequestsState = { phase: 'loading' | 'error' | 'ready'; items: ReturnedPaintRequest[];
  expandedKey: string | null; apparatus: AdminApparatus[] };
export class BoyoqchiRequestsController {
  private state: BoyoqchiRequestsState = { phase: 'loading', items: [], expandedKey: null, apparatus: [] };
  private readonly listeners = new Set<() => void>();
  private generation = 0;
  private catalogGeneration = 0;
  constructor(private readonly loadRequests: () => Promise<ReturnedPaintRequestPage>,
    private readonly loadApparatus: (() => Promise<AdminApparatus[]>) | null = null) {}
  getSnapshot = (): BoyoqchiRequestsState => this.state;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  private update(change: Partial<BoyoqchiRequestsState>) {
    this.state = { ...this.state, ...change };
    this.listeners.forEach(listener => listener());
  }
  async refresh(): Promise<void> {
    const current = ++this.generation;
    this.update({ phase: 'loading', expandedKey: null });
    try {
      const page = await this.loadRequests();
      if (current === this.generation) this.update({ phase: 'ready', items: page.items });
    } catch {
      if (current === this.generation) this.update({ phase: 'error' });
    }
  }
  async refreshApparatus(): Promise<void> {
    if (!this.loadApparatus) return;
    const current = ++this.catalogGeneration;
    try {
      const apparatus = await this.loadApparatus();
      if (current === this.catalogGeneration) this.update({ apparatus });
    } catch { /* V2 keeps the catalog empty and hides raw technical IDs. */ }
  }
  toggle(request: ReturnedPaintRequest): void {
    const key = boyoqchiRequestKey(request);
    this.update({ expandedKey: this.state.expandedKey === key ? null : key });
  }
  cancelPending(): void { this.generation++; this.catalogGeneration++; }
}
