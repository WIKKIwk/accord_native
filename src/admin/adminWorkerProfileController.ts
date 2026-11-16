import type { AdminApparatus } from '../apparatusApi';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { AdminWorkerDetailProfile } from './adminWorkerDetailModel';

type Data = { detail: AdminWorkerDetailProfile; apparatus: readonly AdminApparatus[] };
type State = { valid: boolean; phase: 'loading' | 'error' | 'content'; data: Data | null };
/** @v2 _AdminWorkerProfileDetailScreenState */
export class AdminWorkerProfileController {
  private state: State = { valid: true, phase: 'loading', data: null }; private active = false; private retired = false; private checking = false;
  private generation = 0; private read = 0; private readonly listeners = new Set<() => void>();
  constructor(private readonly deps: { isCurrent: () => boolean; detail: (guard: () => void, witness: () => boolean) => Promise<AdminWorkerDetailProfile>;
    apparatus: (guard: () => void, witness: () => boolean) => Promise<readonly AdminApparatus[]> }) {}
  getSnapshot = () => this.state;
  get interactionGeneration() { return this.generation; }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<State>) { if (!this.active) return; this.state = { ...this.state, ...patch }; for (const listener of [...this.listeners]) listener(); }
  isCurrent = (generation = this.generation): boolean => {
    if (!this.active || this.retired || generation !== this.generation) return false;
    if (this.checking) { this.invalidate(); return false; } this.checking = true; const valid = isSynchronouslyTrue(this.deps.isCurrent); this.checking = false;
    if (!valid || this.retired) { this.invalidate(); return false; } return this.active && generation === this.generation;
  };
  start() { if (this.active || this.retired) return; this.active = true; this.generation++; void this.reload(); }
  async reload(): Promise<void> {
    if (!this.isCurrent()) return; const generation = this.generation, read = ++this.read;
    const current = () => this.isCurrent(generation) && read === this.read;
    const guard = () => { if (!current()) throw Error('Admin worker profile owner changed'); }, witness = () => { guard(); return true; };
    this.publish({ phase: 'loading' });
    // Dart Future.wait's default waits for both futures even after one fails.
    const [detail, apparatus] = await Promise.allSettled([
      Promise.resolve().then(() => { guard(); return this.deps.detail(guard, witness); }),
      Promise.resolve().then(() => { guard(); return this.deps.apparatus(guard, witness); }),
    ]);
    if (!current()) return;
    if (detail.status === 'rejected' || apparatus.status === 'rejected') { this.publish({ phase: 'error', data: null }); return; }
    this.publish({ phase: 'content', data: { detail: detail.value, apparatus: apparatus.value } });
  }
  invalidate() { if (this.retired) return; this.retired = true; this.generation++; this.read++; this.publish({ valid: false, phase: 'loading', data: null }); }
  dispose() { this.active = false; this.generation++; this.read++; this.state = { valid: !this.retired, phase: 'loading', data: null }; this.listeners.clear(); }
}
