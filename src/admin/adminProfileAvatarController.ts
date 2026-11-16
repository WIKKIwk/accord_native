import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { adminProfileAvatarCanLoad } from './adminProfileAvatarModel';
import { dartTrim } from './dartJsonString';

export type AdminProfileAvatarPreview = { id: number; url: string; uri: string | null; displayName: string; loading: boolean };
export type AdminProfileAvatarState = { phase: 'content' | 'invalidated'; url: string; uri: string | null; loading: boolean; preview: AdminProfileAvatarPreview | null };
export type AdminProfileAvatarDependencies = {
  isCurrent: () => boolean; cached: (url: string, guard: () => void) => string | null;
  read: (url: string, guard: () => void, signal: AbortSignal) => Promise<string | null>;
  forget: (url: string, uri: string, guard: () => void) => void;
};
type Job = { url: string; generation: number; active: boolean; abort: AbortController; thumbnail: number | null; preview: number | null };
const initial = (): AdminProfileAvatarState => ({ phase: 'content', url: '', uri: null, loading: false, preview: null });
/** @v2 AdminProfileAvatar
 * Preview captures its original image/title, including when the parent thumbnail later changes.
 * Only jobs inside this mounted owner can be joined; another owner always retains its own request guard. */
export class AdminProfileAvatarController {
  private state = initial(); private active = false; private retired = false; private checking = false; private generation = 0; private thumbnail = 0; private previewSerial = 0;
  private readonly jobs = new Map<string, Job>(); private readonly listeners = new Set<() => void>();
  constructor(private readonly deps: AdminProfileAvatarDependencies) {}
  get interactionGeneration(): number { return this.generation; }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<AdminProfileAvatarState>): void { if (this.active) { this.state = { ...this.state, ...patch }; for (const listener of [...this.listeners]) listener(); } }
  start(): void { if (!this.retired && !this.active) { this.active = true; this.publish({}); } }
  isCurrent = (): boolean => {
    if (!this.active || this.retired) return false;
    if (this.checking) { this.invalidate(); return false; }
    this.checking = true; const current = isSynchronouslyTrue(this.deps.isCurrent); this.checking = false;
    if (!current || this.retired) { this.invalidate(); return false; } return true;
  };
  private guard(generation: number): void { if (generation !== this.generation || !this.isCurrent()) throw Error('Admin avatar owner changed'); }
  setUrl(rawUrl: string): void {
    if (!this.isCurrent()) return;
    const url = dartTrim(rawUrl); if (url === this.state.url) return;
    const generation = this.generation, check = () => this.guard(generation), canLoad = adminProfileAvatarCanLoad(url), thumbnail = ++this.thumbnail;
    let uri: string | null; try { uri = canLoad ? this.deps.cached(url, check) : null; check(); } catch { return; }
    this.publish({ url, uri, loading: canLoad && !uri }); this.prune();
    if (generation === this.generation && this.isCurrent() && this.thumbnail === thumbnail && this.state.url === url && canLoad && !uri) this.ensure(url, thumbnail, null);
  }
  open(displayName: string): void {
    if (!this.isCurrent() || this.state.preview) return;
    const generation = this.generation, check = () => this.guard(generation), url = this.state.url, canLoad = adminProfileAvatarCanLoad(url);
    let uri: string | null; try { uri = this.state.uri ?? (canLoad ? this.deps.cached(url, check) : null); check(); } catch { return; } const id = ++this.previewSerial;
    this.publish({ preview: { id, url, uri, displayName, loading: canLoad && !uri } });
    if (generation === this.generation && this.isCurrent() && this.getSnapshot().preview?.id === id && canLoad && !uri) this.ensure(url, null, id);
  }
  close(id: number): void { if (this.isCurrent() && this.state.preview?.id === id) { this.publish({ preview: null }); this.prune(); } }
  private ensure(url: string, thumbnail: number | null, preview: number | null): void {
    if (!this.isCurrent()) return;
    const existing = this.jobs.get(url);
    if (existing) { if (thumbnail !== null) existing.thumbnail = thumbnail; if (preview !== null) existing.preview = preview; return; }
    const job: Job = { url, generation: this.generation, active: true, abort: new AbortController(), thumbnail, preview };
    this.jobs.set(url, job); void this.read(job);
  }
  private prune(): void {
    for (const [url, job] of this.jobs) {
      if (job.thumbnail !== this.thumbnail || this.state.url !== url) job.thumbnail = null;
      if (job.preview !== this.state.preview?.id || this.state.preview?.url !== url) job.preview = null;
      if (job.thumbnail === null && job.preview === null) { job.active = false; job.abort.abort(); this.jobs.delete(url); }
    }
  }
  private checkJob(job: Job): void { this.guard(job.generation); if (!job.active || job.abort.signal.aborted || this.jobs.get(job.url) !== job) throw Error('Admin avatar image changed'); }
  private install(job: Job, uri: string | null): void {
    this.checkJob(job); const patch: Partial<AdminProfileAvatarState> = {};
    if (job.thumbnail === this.thumbnail && this.state.url === job.url) { patch.uri = uri; patch.loading = false; }
    const preview = this.state.preview;
    if (preview && job.preview === preview.id && preview.url === job.url) patch.preview = { ...preview, uri, loading: false };
    this.publish(patch);
  }
  private async read(job: Job): Promise<void> {
    const check = () => this.checkJob(job);
    try { check(); const uri = await this.deps.read(job.url, check, job.abort.signal); check(); this.install(job, uri); }
    catch { if (job.active && job.generation === this.generation && this.jobs.get(job.url) === job && this.isCurrent()) { try { this.install(job, null); } catch { /* Scope can retire between the fallback checks. */ } } }
    finally { job.active = false; if (this.jobs.get(job.url) === job) this.jobs.delete(job.url); }
  }
  imageCurrent(slot: 'thumbnail' | number, uri: string): boolean {
    if (!this.isCurrent()) return false;
    return slot === 'thumbnail' ? this.state.uri === uri : this.state.preview?.id === slot && this.state.preview.uri === uri;
  }
  imageFailed(slot: 'thumbnail' | number, uri: string): void {
    if (!this.imageCurrent(slot, uri)) return;
    const generation = this.generation, check = () => this.guard(generation), url = slot === 'thumbnail' ? this.state.url : this.state.preview!.url;
    try { this.deps.forget(url, uri, check); check(); } catch { return; }
    if (!this.imageCurrent(slot, uri)) return;
    if (slot === 'thumbnail') this.publish({ uri: null, loading: false });
    else this.publish({ preview: { ...this.state.preview!, uri: null, loading: false } });
  }
  private abortJobs(): void { for (const job of this.jobs.values()) { job.active = false; job.abort.abort(); } this.jobs.clear(); }
  invalidate(): void { if (this.retired) return; this.retired = true; this.generation++; this.thumbnail++; this.abortJobs(); this.publish({ ...initial(), phase: 'invalidated' }); }
  dispose(): void { this.active = false; this.generation++; this.thumbnail++; this.abortJobs(); this.state = { ...initial(), phase: this.retired ? 'invalidated' : 'content' }; this.listeners.clear(); }
}
