import { latestProductionOrderNote, productionNoteText, productionOrderNoteFromJson, type ProductionOrderNote } from '../shared/productionOrderNote';

export type ProductionNoteEditorState = Readonly<{
  original: ProductionOrderNote | null; confirmed: ProductionOrderNote | null;
  draft: string; saving: boolean; error: string | null;
}>;
const initial: ProductionNoteEditorState = { original: null, confirmed: null, draft: '', saving: false, error: null };

/** One editor belongs to one order and one active account witness. */
export class PreparationProductionNoteEditor {
  private state = initial;
  private valid = true;
  private listeners = new Set<() => void>();
  private failed?: (error: unknown) => void;
  constructor(private readonly orderId: string, private readonly current: () => boolean,
    private readonly saveNote: (text: string, revision: number) => Promise<ProductionOrderNote>) {}
  snapshot = () => this.state;
  subscribe = (changed: () => void) => { this.listeners.add(changed); return () => { this.listeners.delete(changed); }; };
  setFailureHandler(handler?: (error: unknown) => void): void { this.failed = handler; }
  private get active() { return this.valid && this.current(); }
  private update(patch: Partial<ProductionNoteEditorState>) {
    this.state = { ...this.state, ...patch }; this.listeners.forEach(changed => changed());
  }
  open(note: ProductionOrderNote): void {
    if (!this.active || this.state.saving || note.order_id !== this.orderId) return;
    const original = latestProductionOrderNote(note, this.state.confirmed);
    this.update({ original, draft: original.text, error: null });
  }
  change = (draft: string): void => {
    if (this.active && this.state.original && !this.state.saving) this.update({ draft, error: null });
  };
  cancel = (): void => {
    if (!this.state.saving) this.update({ original: null, draft: '', error: null });
  };
  get canSave(): boolean {
    if (!this.active || !this.state.original || this.state.saving) return false;
    try { return productionNoteText(this.state.draft) !== this.state.original.text; } catch { return false; }
  }
  save = async (): Promise<void> => {
    if (!this.canSave) return;
    const original = this.state.original!, text = productionNoteText(this.state.draft);
    this.update({ saving: true, error: null });
    try {
      const note = productionOrderNoteFromJson(await this.saveNote(text, original.revision), this.orderId);
      if (!this.active) return;
      if (note.revision !== original.revision + 1 || note.text !== text) throw new Error('Eslatma saqlangani tasdiqlanmadi');
      this.update({ original: null, confirmed: note, draft: '', error: null });
    } catch (error) {
      if (this.active) {
        this.update({ error: error instanceof Error ? error.message : 'Eslatmani saqlab bo‘lmadi. Qayta urinib ko‘ring' });
        this.failed?.(error);
      }
    } finally { if (this.active) this.update({ saving: false }); }
  };
  invalidate = (): void => { this.valid = false; this.update(initial); };
}
