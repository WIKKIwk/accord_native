import type { Session } from '../auth';
import { qolipBlocksData, qolipDeleteBlock, qolipUpdateBlock, type QolipBlock, type QolipBlocksResult } from './qolipBlocksApi';
import { trimDart } from './qolipApiCommon';
import { QolipSearchDocument, QolipSearchQuery } from './qolipSearchEngine';

type BlockApi = {
  read: () => Promise<QolipBlocksResult>;
  update: (block: QolipBlock, name: string) => Promise<unknown>;
  remove: (block: QolipBlock) => Promise<unknown>;
};
export type QolipBlocksNotice = { kind: 'updated' | 'deleted' } | { kind: 'update_failed' | 'delete_failed'; error: unknown };
type State = { blocks: QolipBlock[] | null; query: string; loading: boolean; refreshing: boolean; error: boolean; saving: boolean };

/** @v2 _QolipBlocksScreenState */
export class QolipBlocksState {
  private value: State = { blocks: null, query: '', loading: true, refreshing: false, error: false, saving: false };
  private active = true;
  private readGeneration = 0;
  private lifecycle = 0;
  private readonly listeners = new Set<() => void>();
  private readonly documents = new WeakMap<QolipBlock, QolipSearchDocument>();
  constructor(private readonly api: BlockApi, private readonly notice: (value: QolipBlocksNotice) => void, private readonly isCurrent?: () => boolean) {}
  static forSession(session: Session, notice: (value: QolipBlocksNotice) => void, isCurrent?: () => boolean) {
    return new QolipBlocksState({ read: () => qolipBlocksData(session, isCurrent),
      update: (block, name) => qolipUpdateBlock(session, block, name, isCurrent), remove: block => qolipDeleteBlock(session, block, isCurrent) }, notice, isCurrent);
  }
  private current() { return this.active && this.isCurrent?.() !== false; }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.value;
  private update(patch: Partial<State>) {
    if (!this.current()) return;
    this.value = { ...this.value, ...patch };
    for (const listener of this.listeners) listener();
  }
  activate() {
    if (!this.active) { this.active = true; this.update({ saving: false }); }
  }
  setQuery(query: string) { this.update({ query }); }
  get filtered(): QolipBlock[] {
    const query = new QolipSearchQuery(trimDart(this.value.query));
    return (this.value.blocks ?? []).filter(block => {
      let document = this.documents.get(block);
      if (!document) { document = new QolipSearchDocument([block.name, block.warehouse]); this.documents.set(block, document); }
      return query.matches(document);
    });
  }
  async reload(): Promise<void> {
    if (!this.current()) return;
    const generation = ++this.readGeneration;
    this.update({ loading: this.value.blocks === null, refreshing: true, error: false });
    try {
      const result = await this.api.read();
      if (this.current() && generation === this.readGeneration) this.update({ blocks: result.blocks, loading: false, refreshing: false, error: false });
    } catch (error) {
      if (this.current() && generation === this.readGeneration) this.update({ blocks: null, loading: false, refreshing: false, error: true });
      throw error;
    }
  }
  async edit(block: QolipBlock, rawName: string): Promise<void> {
    const name = trimDart(rawName);
    if (!this.current() || this.value.saving || !name || name === trimDart(block.name)) return;
    await this.run(() => this.api.update(block, name), 'updated', 'update_failed');
  }
  async remove(block: QolipBlock): Promise<void> {
    if (!this.current() || this.value.saving) return;
    await this.run(() => this.api.remove(block), 'deleted', 'delete_failed');
  }
  private async run(action: () => Promise<unknown>, success: 'updated' | 'deleted', failure: 'update_failed' | 'delete_failed') {
    const lifecycle = this.lifecycle;
    this.update({ saving: true });
    try {
      await action();
      if (!this.current() || lifecycle !== this.lifecycle) return;
      this.notice({ kind: success });
      await this.reload();
    } catch (error) {
      if (this.current() && lifecycle === this.lifecycle) this.notice({ kind: failure, error });
    } finally { if (lifecycle === this.lifecycle) this.update({ saving: false }); }
  }
  dispose() { this.active = false; this.readGeneration++; this.lifecycle++; this.listeners.clear(); }
}
