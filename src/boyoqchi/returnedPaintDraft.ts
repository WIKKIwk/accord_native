import { returnedPaintImageFromJson, type ReturnedPaintImage } from './returnedPaintModel';
import type { ReturnedPaintDraftData } from './returnedPaintRules';

type Json = Record<string, unknown>;
const object = (value: unknown): Json | null => value !== null && typeof value === 'object' && !Array.isArray(value)
  ? value as Json : null;
const asText = (value: unknown) => value === null ? 'null' : String(value);
export interface ReturnedPaintDraftStorage {
  read(scope: string): Promise<string | null>;
  write(scope: string, value: string): Promise<void>;
  remove(scope: string): Promise<void>;
}

/** @v2 ReturnedPaintDraft */
export class ReturnedPaintDraft implements ReturnedPaintDraftData {
  readonly values: Record<string, string[]>;
  readonly dynamic_field_labels: Record<string, string[]>;
  private selected: number;
  private currentImage: ReturnedPaintImage | null;
  constructor(private readonly onChanged: () => void, options: { values?: Record<string, string[]>;
    dynamic_field_labels?: Record<string, string[]>; selected_usage_index?: number; image?: ReturnedPaintImage | null } = {}) {
    this.values = Object.fromEntries(Object.entries(options.values ?? {}).map(([key, value]) => [key, [...value]]));
    this.dynamic_field_labels = Object.fromEntries(Object.entries(options.dynamic_field_labels ?? {}).map(([key, value]) => [key, [...value]]));
    this.selected = options.selected_usage_index === 1 ? 1 : 0;
    this.currentImage = options.image ?? null;
  }
  get selectedUsageIndex(): number { return this.selected; }
  set selectedUsageIndex(value: number) {
    const next = value === 1 ? 1 : 0;
    if (next === this.selected) return;
    this.selected = next; this.onChanged();
  }
  setUsage(value: number): void { this.selectedUsageIndex = value; }
  get image(): ReturnedPaintImage | null { return this.currentImage; }
  setImage(value: ReturnedPaintImage | null): void {
    if ((this.currentImage?.image_id ?? null) === (value?.image_id ?? null)) return;
    this.currentImage = value; this.onChanged();
  }
  valuesFor(stateKey: string, length: number): string[] {
    const existing = this.values[stateKey] ?? [];
    return Array.from({ length }, (_, index) => existing[index] ?? '');
  }
  setValue(stateKey: string, index: number, value: string, length: number): void {
    const current = this.valuesFor(stateKey, length);
    if (index < 0 || index >= current.length || current[index] === value) return;
    current[index] = value;
    Object.defineProperty(this.values, stateKey, { value: current, enumerable: true, configurable: true, writable: true });
    this.onChanged();
  }
  dynamicFieldLabelsFor(stateKey: string): string[] { return [...(this.dynamic_field_labels[stateKey] ?? [])]; }
  addNamedField(stateKey: string, label: string): void {
    const normalized = label.trim();
    if (!normalized) return;
    const existing = this.dynamicFieldLabelsFor(stateKey);
    if (existing.some(value => value.toLowerCase() === normalized.toLowerCase())) return;
    existing.push(normalized);
    Object.defineProperty(this.dynamic_field_labels, stateKey, { value: existing, enumerable: true, configurable: true, writable: true });
    this.onChanged();
  }
  fieldLabelsFor(stateKey: string, base: readonly string[]): string[] { return [...base, ...this.dynamicFieldLabelsFor(stateKey)]; }
  toJson(): Json {
    return { values: this.values, dynamic_field_labels: this.dynamic_field_labels, selected_usage_index: this.selected,
      ...(this.currentImage ? { image: this.currentImage } : {}) };
  }
}

function migrateLegacyColorDrafts(values: Record<string, string[]>, labels: Record<string, string[]>): void {
  for (const [key, oldValues] of Object.entries(values)) {
    const parts = key.split(':');
    if (parts.length !== 2 || oldValues.length < 9) continue;
    const [usage, paint] = parts;
    if (['Lak', 'Spirtlar', 'Mix'].includes(paint)) continue;
    values[key] = [oldValues[1], oldValues[2], oldValues[3], oldValues[4], oldValues[5], oldValues[6], oldValues[8]];
    if ((labels[key] ?? []).length) values[key].push(...oldValues.slice(9));
    const mix = oldValues[0].trim();
    if (mix) {
      const mixKey = `${usage}:Mix`, mixLabel = `${paint} Mix`, current = labels[mixKey] ?? [];
      if (!current.includes(mixLabel)) {
        current.push(mixLabel); labels[mixKey] = current;
        values[mixKey] = [...(values[mixKey] ?? []), mix];
      }
    }
  }
}

/** @v2 ReturnedPaintDraftStore */
export class ReturnedPaintDraftStore {
  private readonly cache = new Map<string, ReturnedPaintDraft>();
  private readonly writeChains = new Map<string, Promise<void>>();
  constructor(private readonly storage: ReturnedPaintDraftStorage) {}
  async load(scope: string, initialImage: ReturnedPaintImage | null = null): Promise<ReturnedPaintDraft> {
    const normalized = scope.trim(), cached = this.cache.get(normalized);
    if (cached) return cached;
    let json: Json = {};
    const encoded = await this.storage.read(normalized);
    if (encoded?.trim()) {
      try { json = object(JSON.parse(encoded)) ?? {}; } catch { json = {}; }
    }
    const storedValues = object(json.values), values: Record<string, string[]> = {};
    if (storedValues) for (const [key, raw] of Object.entries(storedValues)) {
      if (Array.isArray(raw)) Object.defineProperty(values, key, { value: raw.map(asText), enumerable: true, configurable: true, writable: true });
    }
    const dynamic: Record<string, string[]> = {}, rawLabels = object(json.dynamic_field_labels);
    const legacy = !Object.hasOwn(json, 'dynamic_field_labels') && Object.hasOwn(json, 'pantone_counts');
    if (rawLabels) {
      for (const [key, raw] of Object.entries(rawLabels)) if (Array.isArray(raw)) {
        Object.defineProperty(dynamic, key, { value: raw.map(asText).map(value => value.trim()).filter(Boolean),
          enumerable: true, configurable: true, writable: true });
      }
    } else {
      const counts = object(json.pantone_counts);
      if (counts) for (const [key, raw] of Object.entries(counts)) {
        if (raw != null && (typeof raw !== 'number' || !Number.isFinite(raw))) throw new TypeError('Invalid Pantone count');
        const count = raw == null ? 0 : Math.trunc(raw as number);
        if (count > 0) Object.defineProperty(dynamic, key, { value: Array.from({ length: count }, (_, index) => `Pantone ${index + 1}`),
          enumerable: true, configurable: true, writable: true });
      }
    }
    if (legacy) migrateLegacyColorDrafts(values, dynamic);
    const rawImage = object(json.image), storedImage = rawImage ? returnedPaintImageFromJson(rawImage) : null;
    const rawIndex = json.selected_usage_index;
    if (rawIndex != null && (typeof rawIndex !== 'number' || !Number.isFinite(rawIndex))) throw new TypeError('Invalid usage index');
    let draft: ReturnedPaintDraft;
    draft = new ReturnedPaintDraft(() => this.schedulePersist(normalized, draft), {
      values, dynamic_field_labels: dynamic, selected_usage_index: rawIndex == null ? 0 : Math.trunc(rawIndex as number),
      image: storedImage?.image_id.trim() ? storedImage : initialImage,
    });
    this.cache.set(normalized, draft);
    if (!storedImage && initialImage) this.schedulePersist(normalized, draft);
    return draft;
  }
  async clear(scope: string): Promise<void> {
    const normalized = scope.trim();
    this.cache.delete(normalized);
    const previous = this.writeChains.get(normalized) ?? Promise.resolve();
    const clearing = previous.then(() => this.storage.remove(normalized));
    this.writeChains.set(normalized, clearing);
    try { await clearing; } finally {
      if (this.writeChains.get(normalized) === clearing) this.writeChains.delete(normalized);
    }
  }
  flush(scope: string): Promise<void> { return this.writeChains.get(scope.trim()) ?? Promise.resolve(); }
  private schedulePersist(scope: string, draft: ReturnedPaintDraft): void {
    const previous = this.writeChains.get(scope) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(() => this.storage.write(scope, JSON.stringify(draft.toJson())));
    this.writeChains.set(scope, next);
    // A flush captured for this write rejects on failure; later edits can retry.
    void next.catch(() => {});
  }
}
