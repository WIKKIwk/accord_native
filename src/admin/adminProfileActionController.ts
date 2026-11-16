import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { dartJsonString } from './dartJsonString';

type Profile = Record<string, unknown>;
type State = { valid: boolean; uri: string | null };
export const adminProfileActionKey = (profile: Profile) => [profile.access_role ?? profile.role, profile.ref, profile.avatar_url].map(value => value == null ? '' : dartJsonString(value)).join(':');
/** @v2 _AppShellProfileActionState */
export class AdminProfileActionController {
  private state: State = { valid: true, uri: null }; private active = false; private retired = false; private checking = false;
  private generation = 0; private request = 0; private key: string | null = null; private readonly listeners = new Set<() => void>();
  constructor(private readonly deps: { isCurrent: () => boolean; load: (profile: Profile, current: () => boolean) => Promise<string | null> }) {}
  getSnapshot = () => this.state;
  get interactionGeneration() { return this.generation; }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<State>) { if (!this.active) return; this.state = { ...this.state, ...patch }; for (const listener of [...this.listeners]) listener(); }
  isCurrent = (generation = this.generation): boolean => {
    if (!this.active || this.retired || generation !== this.generation) return false;
    if (this.checking) { this.invalidate(); return false; } this.checking = true; const valid = isSynchronouslyTrue(this.deps.isCurrent); this.checking = false;
    if (!valid || this.retired) { this.invalidate(); return false; } return this.active && generation === this.generation;
  };
  start() { if (this.active || this.retired) return; this.active = true; this.generation++; this.publish({}); }
  update(profile: Profile, force = false): void {
    if (!this.isCurrent()) return; const key = adminProfileActionKey(profile); if (!force && this.key === key) return; this.key = key;
    const generation = this.generation, request = ++this.request, snapshot = { ...profile };
    const current = () => this.isCurrent(generation) && request === this.request && this.key === key;
    // The source keeps the previous bytes until the new original-key request settles.
    void Promise.resolve().then(() => current() ? this.deps.load(snapshot, current) : null).then(uri => {
      if (current()) this.publish({ uri });
    }, () => { if (current()) this.publish({ uri: null }); });
  }
  invalidate() { if (this.retired) return; this.retired = true; this.generation++; this.request++; this.publish({ valid: false, uri: null }); }
  dispose() { this.active = false; this.generation++; this.request++; this.key = null; this.state = { valid: !this.retired, uri: null }; this.listeners.clear(); }
}
