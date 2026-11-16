import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';

type Order = { map: { id: string; title: string; customer_name: string } };
type State = { phase: 'idle' | 'loading' | 'ready' | 'error' | 'invalid'; order: Order | null };
export class AdminWarehouseItemRollsOrderController {
  private state: State = { phase: 'idle', order: null }; private listeners = new Set<() => void>(); private active = false; private retired = false; private lifetime = 0; private request = 0;
  constructor(private readonly deps: { current: () => boolean; read: (guard: () => void, witness: () => boolean) => Promise<Order> }) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  get generation() { return this.lifetime; }
  private publish(change: State) { this.state = change; for (const listener of this.listeners) listener(); }
  current = (lifetime = this.lifetime) => this.active && !this.retired && lifetime === this.lifetime && isSynchronouslyTrue(this.deps.current) && this.active && lifetime === this.lifetime && !this.retired;
  start() { if (!this.active && !this.retired) { this.active = true; this.lifetime++; void this.load(); } }
  dispose() { this.active = false; this.lifetime++; this.request++; }
  invalidate() { this.retired = true; this.dispose(); this.publish({ phase: 'invalid', order: null }); }
  load = async () => {
    if (!this.current()) return; const lifetime = this.lifetime, request = ++this.request, witness = () => this.current(lifetime) && request === this.request;
    const guard = () => { if (!witness()) throw new Error('Warehouse order detail changed'); };
    this.publish({ phase: 'loading', order: null });
    try { guard(); const order = await this.deps.read(guard, witness); guard(); this.publish({ phase: 'ready', order }); }
    catch { if (witness()) this.publish({ phase: 'error', order: null }); }
  };
}
