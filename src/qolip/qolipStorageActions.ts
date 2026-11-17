import { MobileApiException } from '../shared/mobileApiException';
import type { QolipArchiveEntry, QolipPaddon, QolipPaddonDetail, QolipStorageMold } from './qolipStorageApi';
import { QolipStorageIntent } from './qolipStorageIntent';
import type { QolipPaddonCreateDraft } from './qolipStorageFormsState';

type Body = Record<string, string | number | boolean | null | string[]>;
type Deps = {
  current(): boolean; text(key: string): string; notice(message: string): void; error(error: unknown): void;
  changed(): void; reload(): Promise<void>; warehouses(): Promise<readonly string[]>;
  createDialog(warehouses: readonly string[], draft: QolipPaddonCreateDraft | null): Promise<QolipPaddonCreateDraft | null>;
  confirm(title: string, body: string, destructive?: boolean): Promise<boolean>;
  selectMolds(warehouse?: string, paddonCode?: string, scan?: boolean): Promise<readonly QolipStorageMold[] | null>;
  openPaddon(code: string, add?: boolean): void;
  detail(code: string): Promise<QolipPaddonDetail>; action(body: Body): Promise<QolipPaddonDetail>;
  archive(body: Body): Promise<readonly QolipArchiveEntry[]>; delete(body: Body): Promise<void>;
  nextId?(): Promise<string>;
  notFound?(): string;
  removePaddon?(code: string): void;
};

/** @v2 _QolipStorageScreenState: actual list actions, including retained retry bodies. */
export class QolipStorageActions {
  saving = false;
  private readonly intent: QolipStorageIntent;
  private createDraft: QolipPaddonCreateDraft | null = null;
  private pendingArchive: readonly QolipStorageMold[] | null = null;
  private readonly pendingDeletes = new Map<string, Body>();
  private readonly listeners = new Set<() => void>();
  private revision = 0;
  constructor(private readonly deps: Deps) { this.intent = new QolipStorageIntent(deps.nextId); }
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getSnapshot = () => this.revision;
  get pendingArchiveCount() { return this.pendingArchive?.length ?? 0; }
  private notify() { this.revision++; for (const fn of this.listeners) fn(); }
  private setSaving(value: boolean) { this.saving = value; this.notify(); }
  cancelArchive() { if (!this.saving && this.allowed()) { this.pendingArchive = null; this.intent.complete(); this.notify(); } }
  private allowed() { return this.deps.current(); }
  async create(): Promise<void> {
    if (this.saving || !this.allowed()) return;
    this.setSaving(true);
    try {
      const warehouses = await this.deps.warehouses(); if (!this.allowed()) return;
      if (!warehouses.length) { this.deps.notice(this.deps.text('no_warehouse')); return; }
      const draft = await this.deps.createDialog(warehouses, this.createDraft); if (!draft || !this.allowed()) return;
      this.createDraft = draft;
      const body: Body = { action: 'create', ...draft };
      body.request_id = await this.intent.keyFor(body); if (!this.allowed()) return;
      const detail = await this.deps.action(body);
      if (!this.allowed()) return;
      this.intent.complete(); this.createDraft = null; this.deps.openPaddon(detail.paddon.code);
    } catch (error) { if (this.allowed()) this.deps.error(error); }
    finally { this.setSaving(false); }
  }
  async archiveMolds(): Promise<void> {
    if (this.saving || !this.allowed()) return;
    const molds = this.pendingArchive ?? await this.deps.selectMolds();
    if (!this.allowed() || !molds?.length) return;
    this.pendingArchive = molds; this.notify();
    const codes = molds.map(mold => mold.code).sort();
    if (!await this.deps.confirm(this.deps.text('archive_action'), `${this.deps.text('archive_hint')}\n\n${codes.join('\n')}`) || !this.allowed()) return;
    this.setSaving(true);
    try {
      const body: Body = { action: 'archive', qolip_codes: codes };
      body.request_id = await this.intent.keyFor(body); if (!this.allowed()) return;
      await this.deps.archive(body); if (!this.allowed()) return;
      this.pendingArchive = null; this.intent.complete(); this.deps.changed(); this.deps.notice(this.deps.text('saved')); await this.deps.reload();
    } catch (error) { if (this.allowed()) this.deps.error(error); }
    finally { this.setSaving(false); }
  }
  async deletePaddon(paddon: QolipPaddon): Promise<void> {
    if (this.saving || !this.allowed()) return;
    let body = this.pendingDeletes.get(paddon.code);
    if (!body) {
      this.setSaving(true);
      try {
        const detail = await this.deps.detail(paddon.code); if (!this.allowed()) return;
        if (detail.paddon.item_count !== 0 || detail.items.length) {
          this.deps.notice(this.deps.text('paddon_not_empty'));
          if (detail.paddon.revision !== paddon.revision || detail.paddon.item_count !== paddon.item_count) await this.deps.reload();
          return;
        }
        if (detail.paddon.archived) { this.deps.notice(this.deps.text('archived_error')); await this.deps.reload(); return; }
        body = { action: 'delete', code: paddon.code, expected_revision: detail.paddon.revision };
      } catch (error) {
        if (this.allowed()) {
          if (error instanceof MobileApiException && error.statusCode === 404) await this.missing(paddon.code);
          else this.deps.error(error);
        }
        return;
      } finally { this.setSaving(false); }
    }
    if (!this.allowed() || !await this.deps.confirm(this.deps.text('delete_paddon_title'), `${paddon.code}\n\n${this.deps.text('delete_paddon_confirm')}`, true) || !this.allowed()) return;
    if (!this.pendingDeletes.has(paddon.code)) {
      try { body.request_id = await new QolipStorageIntent(this.deps.nextId).keyFor(body); }
      catch (error) { if (this.allowed()) this.deps.error(error); return; }
      if (!this.allowed()) return;
      this.pendingDeletes.set(paddon.code, body);
    }
    this.setSaving(true);
    try {
      await this.deps.delete(body); if (!this.allowed()) return;
      this.pendingDeletes.delete(paddon.code); this.deps.removePaddon?.(paddon.code); this.deps.notice(this.deps.text('paddon_deleted')); await this.deps.reload();
    } catch (error) {
      if (!this.allowed()) return;
      if (error instanceof MobileApiException && error.statusCode === 404) { await this.missing(paddon.code); return; }
      if (error instanceof MobileApiException && error.statusCode === 409) this.pendingDeletes.delete(paddon.code);
      this.deps.error(error);
      if (error instanceof MobileApiException && error.statusCode === 409) await this.deps.reload();
    } finally { this.setSaving(false); }
  }
  private async missing(code: string) { this.pendingDeletes.delete(code); this.deps.removePaddon?.(code); this.deps.notice(this.deps.notFound?.() ?? this.deps.text('not_found')); await this.deps.reload(); }
}

type PaddonDeps = Pick<Deps, 'current' | 'text' | 'notice' | 'error' | 'changed' | 'confirm' | 'detail' | 'action' | 'nextId'>;
/** @v2 _QolipPaddonScreenState */
export class QolipPaddonActions {
  detail: QolipPaddonDetail | null = null;
  loading = true; saving = false; error: unknown = null;
  pendingAction: string | null = null; pendingCodes: string[] = []; inspection: Record<string, unknown> | null = null;
  private generation = 0;
  private readonly intent: QolipStorageIntent;
  private revision = 0;
  private readonly listeners = new Set<() => void>();
  constructor(readonly code: string, private readonly deps: PaddonDeps) { this.intent = new QolipStorageIntent(deps.nextId); }
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getSnapshot = () => this.revision;
  private notify() { this.revision++; for (const fn of this.listeners) fn(); }
  dispose() { this.generation++; }
  async load() {
    if (!this.deps.current()) return;
    const generation = ++this.generation; this.loading = true; this.error = null; this.notify();
    try { const detail = await this.deps.detail(this.code); if (generation === this.generation && this.deps.current()) this.detail = detail; }
    catch (error) { if (generation === this.generation && this.deps.current()) this.error = error; }
    finally { if (generation === this.generation && this.deps.current()) { this.loading = false; this.notify(); } }
  }
  async act(action: string, codes: readonly string[] = []) {
    if (this.saving || !this.detail || !this.deps.current()) return;
    const detail = this.detail;
    const hint = action === 'archive' ? 'archive_hint' : action === 'restore' ? 'restore_hint'
      : action === 'lock' || action === 'unlock' ? 'lock_hint' : action === 'remove' ? 'remove_hint' : action === 'inspect' ? 'inspect_hint' : 'confirm';
    const reviewed = !codes.length && action !== 'inspect' ? detail.items.map(mold => mold.code) : codes;
    if (!await this.deps.confirm(`${this.deps.text(action === 'archive' ? 'archive_action' : action)} — ${detail.paddon.code}`,
      `${this.deps.text(hint)}\n\n${reviewed.join('\n')}`) || !this.deps.current()) return;
    const sorted = [...codes].sort();
    const body: Body = { action, code: detail.paddon.code, expected_revision: detail.paddon.revision, qolip_codes: sorted };
    try { body.request_id = await this.intent.keyFor(body); }
    catch (error) { if (this.deps.current()) this.deps.error(error); return; }
    if (!this.deps.current()) return;
    this.saving = true; this.pendingAction = action; this.pendingCodes = sorted; this.notify();
    try {
      const saved = await this.deps.action(body); if (!this.deps.current()) return;
      this.generation++; this.detail = null; this.inspection = saved.inspection; this.pendingAction = null; this.pendingCodes = [];
      this.intent.complete(); this.deps.changed(); this.deps.notice(this.deps.text('saved')); await this.load();
    } catch (error) {
      if (!this.deps.current()) return;
      this.deps.error(error);
      if (error instanceof MobileApiException && error.statusCode === 409) { this.intent.complete(); await this.load(); }
    } finally { this.saving = false; this.notify(); }
  }
}

/** @v2 QolipArchiveDetailScreenState */
export class QolipArchiveRestore {
  saving = false; restored = false;
  private revision = 0; private readonly listeners = new Set<() => void>();
  private body: Body | null = null;
  private readonly intent: QolipStorageIntent;
  constructor(readonly entry: QolipArchiveEntry, private readonly deps: PaddonDeps & Pick<Deps, 'archive'>) { this.intent = new QolipStorageIntent(deps.nextId); }
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getSnapshot = () => this.revision;
  private notify() { this.revision++; for (const fn of this.listeners) fn(); }
  async restore() {
    if (this.saving || this.restored || this.entry.kind === 'paddon_mold' || !this.deps.current()) return;
    if (!await this.deps.confirm(this.deps.text('restore'), `${this.entry.code}\n${this.deps.text('restore_hint')}`) || !this.deps.current()) return;
    this.saving = true; this.notify();
    try {
      if (this.entry.kind === 'paddon') {
        if (!this.body) {
          const detail = await this.deps.detail(this.entry.code); if (!this.deps.current()) return;
          if (detail.paddon.archive_entry_id !== this.entry.id) throw new MobileApiException({ code: 'qolip_archive_changed', message: 'Archive visit changed', statusCode: 409 });
          this.body = { action: 'restore', code: this.entry.code, expected_revision: detail.paddon.revision };
          this.body.request_id = await this.intent.keyFor(this.body);
        }
        if (!this.deps.current()) return;
        await this.deps.action(this.body);
      } else {
        const body: Body = { action: 'restore', entry_ids: [this.entry.id] };
        body.request_id = await this.intent.keyFor(body); if (!this.deps.current()) return;
        await this.deps.archive(body);
      }
      if (!this.deps.current()) return;
      this.intent.complete(); this.restored = true; this.deps.changed(); this.deps.notice(this.deps.text('saved'));
    } catch (error) {
      if (error instanceof MobileApiException && error.statusCode === 409) { this.body = null; this.intent.complete(); }
      if (this.deps.current()) this.deps.error(error);
    } finally { this.saving = false; this.notify(); }
  }
}
