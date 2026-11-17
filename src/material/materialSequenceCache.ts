import { apparatusFromJson, apparatusToJson, type AdminApparatus } from '../apparatusApi';
import { appPreferences } from '../appPreferences';
import { activeSessionToken, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { productionSnapshotStore } from '../shared/productionSnapshotRuntime';
import type { ProductionSnapshotStore } from '../shared/productionSnapshotStore';
import { decodeMaterialSequenceSnapshot, materialSequenceWire } from './materialSequenceApi';
import type { MaterialSequenceSnapshot } from './materialSequenceModel';
import { isMaterialTestSession } from './materialTestSession';

type Snapshots = Pick<ProductionSnapshotStore, 'read' | 'writeEncoded' | 'remove' | 'generation'>;
type Options = { snapshots?: Snapshots; demoMode?(): Promise<boolean>; restoreTimeoutMs?: number; saveDelayMs?: number };
export type MaterialSequenceCachedValue = { snapshot: MaterialSequenceSnapshot; apparatus: AdminApparatus[] };
export type MaterialSequenceCachePort = { load(): Promise<MaterialSequenceCachedValue | null>;
  save(snapshot: MaterialSequenceSnapshot, apparatus: readonly AdminApparatus[]): Promise<void>; clear(): Promise<void>; flush(): Promise<void> };
/** @v2 _canonicalCacheKey: non-worker, supplyViewerMode, readOnly. */
export const materialSequenceCacheKey = JSON.stringify(['canonical-queue-v1', false, true, true]);
const object = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

/** @v2 encodeCachedApparatus: retain intervals and cache-only catalog metadata. */
function encodeApparatus(apparatus: AdminApparatus) {
  return { ...apparatusToJson(apparatus), capabilities: apparatus.capability_profiles.map(profile => ({ ...profile })),
    _cache_source: apparatus.source, _cache_family: apparatus.family, _cache_kind: apparatus.kind, _cache_capabilities: [...apparatus.capabilities] };
}
function decodeApparatus(raw: unknown): AdminApparatus {
  const value = object(raw);
  if (!value || !Array.isArray(value._cache_capabilities) || value._cache_capabilities.some(entry => typeof entry !== 'string') ||
    typeof value._cache_source !== 'string' || typeof value._cache_family !== 'string' || typeof value._cache_kind !== 'string') throw new TypeError('Invalid cached apparatus');
  const decoded = apparatusFromJson(value);
  return { ...decoded, source: value._cache_source as AdminApparatus['source'], family: value._cache_family,
    kind: value._cache_kind, capabilities: value._cache_capabilities as string[] };
}

/** @v2 _decodeCanonicalSnapshotCache plus _restoreCanonicalQueueCacheOnce version/duplicate checks. */
export function decodeMaterialSequenceCache(raw: unknown, session: Session): MaterialSequenceCachedValue {
  const value = object(raw), wire = object(value?.snapshot), catalog = value?.apparatus;
  if (value?.schema !== 1 || !wire || !Array.isArray(catalog) || !catalog.length || catalog.length > 200 ||
    !Array.isArray(wire.maps) || !Array.isArray(wire.completed_orders) || !Array.isArray(wire.completion_requests) ||
    !Array.isArray(wire.completion_request_decisions)) throw new TypeError('Invalid production cache');
  const snapshot = decodeMaterialSequenceSnapshot(wire, session, true), apparatus = catalog.map(decodeApparatus);
  if (!Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0 || !snapshot.epoch || snapshot.maps.length !== wire.maps.length ||
    new Set(snapshot.maps.map((saved: { map: { id: string } }) => saved.map.id)).size !== snapshot.maps.length ||
    new Set(apparatus.map(item => item.id)).size !== apparatus.length) throw new TypeError('Unversioned production cache');
  snapshot.materialSequenceLiveExtras = true;
  return { snapshot, apparatus };
}

/** Optional canonical disk baseline. The controller must validate continuity before enabling action/save paths. */
export class MaterialSequenceCache implements MaterialSequenceCachePort {
  private readonly snapshots: Snapshots;
  private readonly scope: string;
  private readonly diskGeneration: number;
  private version = 0;
  private restoreGeneration = 0;
  private pending: { timer: ReturnType<typeof setTimeout>; finish(): void; flush(): Promise<void> } | null = null;
  private lastSnapshot: MaterialSequenceSnapshot | null = null;
  private lastApparatus: readonly AdminApparatus[] | null = null;
  constructor(private readonly session: Session, private readonly isCurrent: () => boolean, private readonly options: Options = {}) {
    this.snapshots = options.snapshots ?? productionSnapshotStore;
    this.scope = sessionReadScope(session); this.diskGeneration = this.snapshots.generation;
  }
  private current() {
    try { return this.isCurrent() === true && !!activeSessionToken(this.session) && !isMaterialTestSession(this.session) &&
      this.session.profile.role === 'material_taminotchi' && this.scope === sessionReadScope(this.session) && this.diskGeneration === this.snapshots.generation; }
    catch { return false; }
  }
  private async demoMode() {
    return this.options.demoMode ? this.options.demoMode() : await appPreferences.getItem('test_mode_enabled') === 'true';
  }
  async load(): Promise<MaterialSequenceCachedValue | null> {
    if (!this.current()) return null;
    const generation = ++this.restoreGeneration, version = this.version;
    let expired = false, timer: ReturnType<typeof setTimeout> | undefined;
    const current = () => !expired && generation === this.restoreGeneration && version === this.version && this.current();
    try {
      return await Promise.race([(async () => {
        if (await this.demoMode() || !current()) return null;
        const value = await this.snapshots.read(this.scope, materialSequenceCacheKey);
        if (!value || !current()) return null;
        try { return decodeMaterialSequenceCache(value, this.session); }
        catch { if (current()) void this.snapshots.remove(this.scope, materialSequenceCacheKey).catch(() => {}); return null; }
      })().catch(() => null), new Promise<null>(resolve => { timer = setTimeout(() => { expired = true; resolve(null); }, this.options.restoreTimeoutMs ?? 500); })]);
    } finally { expired = true; if (timer !== undefined) clearTimeout(timer); }
  }
  /** Called only after live-extras and continuity validation, with no pending sequence move/reconciliation. */
  save(snapshot: MaterialSequenceSnapshot, apparatus: readonly AdminApparatus[]): Promise<void> {
    if (!this.current() || !snapshot.materialSequenceLiveExtras || snapshot.materialSequenceUnreconciled ||
      snapshot === this.lastSnapshot && apparatus === this.lastApparatus) return Promise.resolve();
    let encoded: string;
    try {
      const wire = materialSequenceWire(snapshot);
      const value = { schema: 1, snapshot: wire, apparatus: apparatus.map(encodeApparatus) };
      decodeMaterialSequenceCache(value, this.session); encoded = JSON.stringify(value);
    } catch { return Promise.resolve(); }
    this.cancel();
    const version = ++this.version;
    return new Promise(resolve => {
      let writing: Promise<void> | null = null;
      const flush = (): Promise<void> => {
        if (writing) return writing;
        this.pending = null;
        writing = (async () => {
          if (!this.current() || version !== this.version || await this.demoMode() || !this.current() || version !== this.version) return;
          await this.snapshots.writeEncoded(this.scope, materialSequenceCacheKey, encoded, this.diskGeneration);
          if (this.current() && version === this.version) { this.lastSnapshot = snapshot; this.lastApparatus = apparatus; }
        })().catch(() => {}).finally(resolve);
        return writing;
      };
      const timer = setTimeout(() => { void flush(); }, this.options.saveDelayMs ?? 400);
      this.pending = { timer, finish: resolve, flush };
    });
  }
  private cancel() { if (this.pending) { clearTimeout(this.pending.timer); this.pending.finish(); this.pending = null; } }
  flush() { if (!this.pending) return Promise.resolve(); clearTimeout(this.pending.timer); return this.pending.flush(); }
  clear() {
    this.cancel(); this.version++; this.restoreGeneration++; this.lastSnapshot = null; this.lastApparatus = null;
    return this.current() ? this.snapshots.remove(this.scope, materialSequenceCacheKey).catch(() => {}) : Promise.resolve();
  }
}

export function createMaterialSequenceCache(session: Session, isCurrent: () => boolean): MaterialSequenceCachePort {
  return new MaterialSequenceCache(session, isCurrent);
}
