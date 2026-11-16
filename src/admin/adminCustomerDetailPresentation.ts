import type { SupplierItem } from '../shared/catalogApi';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { AdminCustomerDetailController, AdminCustomerDetailPrompt, AdminCustomerGroupChoices } from './adminCustomerDetailController';
import type { AdminCustomerDetail } from './adminCustomerDetailModel';
import { dartPartialLower, dartTrim } from './dartJsonString';

export type AdminCustomerItemSheet = Readonly<{ id: number; kind: 'assigned' | 'available'; detail: AdminCustomerDetail;
  items: readonly SupplierItem[]; activeCode: string | null; collapsingCodes: readonly string[]; closing: boolean }>;
export type AdminCustomerGroupSheet = Readonly<{ id: number; kind: 'groups'; choices: AdminCustomerGroupChoices;
  query: string; selectedKeys: readonly string[]; closing: boolean }>;
export type AdminCustomerSheet = AdminCustomerItemSheet | AdminCustomerGroupSheet;
export type AdminCustomerPresentationState = Readonly<{ sheets: readonly AdminCustomerSheet[] }>;
type Dependencies = { controller: AdminCustomerDetailController; interactive: () => boolean; onRemoved: () => void;
  schedule?: (callback: () => void, milliseconds: number) => unknown; cancel?: (handle: unknown) => void };
const empty = (): AdminCustomerPresentationState => Object.freeze({ sheets: Object.freeze([]) });
const groupKey = (value: string) => dartPartialLower(dartTrim(value));

/** @v2 Customer detail's private sheet snapshots and StatefulBuilder row lifetimes. */
export class AdminCustomerDetailPresentation {
  private state = empty(); private active = false; private generation = 0; private coreGeneration = 0; private nextId = 0; private openingPrompt = false;
  private closingPrompt: AdminCustomerDetailPrompt | null = null;
  private readonly promptDecisions = new WeakMap<AdminCustomerDetailPrompt, boolean>();
  private readonly listeners = new Set<() => void>();
  private readonly groupResults = new Map<number, (selected: readonly string[] | null) => void>();
  private readonly closeResults = new Map<number, readonly string[] | null>();
  private readonly promptResults = new Map<AdminCustomerDetailPrompt, (removed: boolean) => void>();
  private readonly claimedPrompts = new WeakSet<AdminCustomerDetailPrompt>();
  private readonly timers = new Set<() => void>();
  constructor(private readonly deps: Dependencies) {}
  getSnapshot = () => this.state;
  get interactionGeneration() { return this.generation; }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(sheets: readonly AdminCustomerSheet[]) {
    if (!this.active) return; this.state = Object.freeze({ sheets: Object.freeze([...sheets]) }); for (const listener of [...this.listeners]) listener();
  }
  activate(): void { if (this.active) return; this.active = true; this.generation++; this.coreGeneration = this.deps.controller.interactionGeneration; this.publish([]); }
  detach(): void {
    this.active = false; this.generation++; this.openingPrompt = false; this.closingPrompt = null;
    const groups = [...this.groupResults.values()], prompts = [...this.promptResults.values()];
    this.groupResults.clear(); this.promptResults.clear(); this.closeResults.clear();
    for (const finish of [...this.timers]) finish();
    this.state = empty(); for (const listener of [...this.listeners]) listener();
    groups.forEach(resolve => resolve(null)); prompts.forEach(resolve => resolve(false));
  }
  lifetimeCurrent = (generation = this.generation): boolean => {
    if (!this.active || generation !== this.generation || this.coreGeneration !== this.deps.controller.interactionGeneration) return false;
    if (!this.deps.controller.isCurrent(this.coreGeneration)) { this.detach(); return false; }
    return this.active && generation === this.generation;
  };
  current = (generation = this.generation) => this.lifetimeCurrent(generation) && !this.deps.controller.getSnapshot().removed;
  private interactive(generation = this.generation) { return this.current(generation) && isSynchronouslyTrue(this.deps.interactive); }
  private sheet(id: number) { return this.state.sheets.find(sheet => sheet.id === id); }
  private promptClosing(): boolean {
    if (this.closingPrompt && this.deps.controller.getSnapshot().prompt !== this.closingPrompt) this.closingPrompt = null;
    return this.closingPrompt !== null;
  }
  private replace(sheet: AdminCustomerSheet) { this.publish(this.state.sheets.map(value => value.id === sheet.id ? Object.freeze(sheet) : value)); }
  sheetCurrent = (id: number, generation = this.generation): boolean => this.current(generation) && !!this.sheet(id);
  sheetInteractive = (id: number, generation = this.generation): boolean => this.interactive(generation) &&
    !this.openingPrompt && !this.promptClosing() && this.deps.controller.getSnapshot().prompt === null && this.state.sheets.at(-1)?.id === id && this.sheet(id)?.closing === false;
  parentInteractive = (generation = this.generation): boolean => this.interactive(generation) && !this.openingPrompt &&
    !this.promptClosing() && this.state.sheets.length === 0 && this.deps.controller.getSnapshot().prompt === null;
  private controls(generation = this.generation) { return this.parentInteractive(generation) && this.deps.controller.mode.management && this.deps.controller.getSnapshot().expanded; }
  private push(sheet: AdminCustomerSheet) { this.publish([...this.state.sheets, Object.freeze(sheet)]); }
  openAssigned(detail: AdminCustomerDetail, generation = this.generation): void {
    if (!this.controls(generation) || !this.deps.controller.mode.items || !detail.assigned_items.length) return;
    this.push({ id: ++this.nextId, kind: 'assigned', detail, items: Object.freeze([...detail.assigned_items]), activeCode: this.deps.controller.getSnapshot().removingItemCode, collapsingCodes: Object.freeze([]), closing: false });
  }
  async openAvailable(generation = this.generation): Promise<void> {
    if (!this.controls(generation) || !this.deps.controller.mode.items || this.deps.controller.getSnapshot().addingItem) return;
    try {
      const available = await this.deps.controller.availableItems();
      if (available && this.current(generation)) this.push({ id: ++this.nextId, kind: 'available', detail: available.detail,
        items: Object.freeze([...available.items]), activeCode: null, collapsingCodes: Object.freeze([]), closing: false });
    } catch {}
  }
  async editGroups(generation = this.generation): Promise<void> {
    if (!this.controls(generation) || !this.deps.controller.mode.material) return;
    await this.deps.controller.editGroups(choices => {
      if (!this.current(generation) || !isSynchronouslyTrue(choices.isCurrent)) return Promise.resolve(null);
      const id = ++this.nextId;
      return new Promise<readonly string[] | null>(resolve => {
        this.groupResults.set(id, resolve);
        this.push({ id, kind: 'groups', choices, query: '', selectedKeys: Object.freeze([...new Set(choices.selected.map(groupKey).filter(Boolean))]), closing: false });
      });
    });
  }
  visibleGroups(sheet: AdminCustomerGroupSheet): readonly string[] { return sheet.choices.available.filter(group => !sheet.query || dartPartialLower(group).includes(sheet.query)); }
  searchGroups(id: number, query: string, generation = this.generation): void {
    if (!this.sheetInteractive(id, generation)) return; const sheet = this.sheet(id); if (sheet?.kind === 'groups') this.replace({ ...sheet, query: groupKey(query) });
  }
  toggleGroup(id: number, group: string, checked: boolean, generation = this.generation): void {
    if (!this.sheetInteractive(id, generation)) return; const sheet = this.sheet(id);
    if (sheet?.kind !== 'groups' || !sheet.choices.available.includes(group)) return;
    const key = groupKey(group), selected = new Set(sheet.selectedKeys); if (checked) selected.add(key); else selected.delete(key);
    this.replace({ ...sheet, selectedKeys: Object.freeze([...selected]) });
  }
  beginCloseSheet(id: number, saveGroups = false, generation = this.generation): boolean {
    if (!this.sheetInteractive(id, generation)) return false; const sheet = this.sheet(id)!;
    if (saveGroups && (sheet.kind !== 'groups' || !sheet.selectedKeys.length)) return false;
    const selection = sheet.kind === 'groups' && saveGroups ? sheet.choices.available.filter(group => sheet.selectedKeys.includes(groupKey(group))) : null;
    this.closeResults.set(id, selection); this.replace({ ...sheet, closing: true }); return true;
  }
  finishCloseSheet(id: number, generation = this.generation): void {
    if (!this.current(generation) || !this.sheet(id)?.closing) return;
    const resolve = this.groupResults.get(id), selection = this.closeResults.get(id) ?? null;
    this.groupResults.delete(id); this.closeResults.delete(id); this.publish(this.state.sheets.filter(sheet => sheet.id !== id));
    resolve?.(this.current(generation) ? selection : null);
  }
  nativeBeginDismiss(id: number, generation = this.generation): void {
    if (!this.current(generation) || this.state.sheets.at(-1)?.id !== id || this.deps.controller.getSnapshot().prompt) return;
    const sheet = this.sheet(id); if (!sheet || sheet.closing) return;
    this.closeResults.set(id, null); this.replace({ ...sheet, closing: true });
  }
  dismissSheet(id: number, generation = this.generation): void { if (this.beginCloseSheet(id, false, generation)) this.finishCloseSheet(id, generation); }
  private async pause(): Promise<void> {
    await new Promise<void>(resolve => {
      let handle: unknown, finished = false;
      const finish = () => { if (finished) return; finished = true; this.timers.delete(finish);
        if (handle !== undefined) (this.deps.cancel ?? (value => clearTimeout(value as ReturnType<typeof setTimeout>)))(handle); resolve(); };
      this.timers.add(finish); handle = (this.deps.schedule ?? ((callback, milliseconds) => setTimeout(callback, milliseconds)))(finish, 180);
    });
  }
  private async removeItem(item: SupplierItem): Promise<boolean> {
    if (this.deps.controller.getSnapshot().prompt || this.openingPrompt) return false;
    this.openingPrompt = true;
    try {
      this.deps.controller.requestRemove(item); const prompt = this.deps.controller.getSnapshot().prompt;
      if (!prompt || prompt.kind !== 'item' || prompt.item !== item || !this.current()) return false;
      return await new Promise<boolean>(resolve => { this.promptResults.set(prompt, resolve); this.openingPrompt = false; });
    } finally { this.openingPrompt = false; }
  }
  async actOnItem(id: number, item: SupplierItem, generation = this.generation): Promise<void> {
    if (!this.sheetInteractive(id, generation)) return; const sheet = this.sheet(id);
    if (!sheet || sheet.kind === 'groups' || !sheet.items.includes(item) || sheet.activeCode === item.code || sheet.collapsingCodes.includes(item.code)) return;
    this.replace({ ...sheet, activeCode: item.code });
    if (!this.current(generation)) return;
    const success = sheet.kind === 'available' ? await this.deps.controller.assignItem(item) : await this.removeItem(item);
    if (!this.sheetCurrent(id, generation)) return; let latest = this.sheet(id) as AdminCustomerItemSheet;
    if (!success) { this.replace({ ...latest, activeCode: null }); return; }
    this.replace({ ...latest, collapsingCodes: Object.freeze([...new Set([...latest.collapsingCodes, item.code])]) });
    await this.pause(); if (!this.sheetCurrent(id, generation)) return; latest = this.sheet(id) as AdminCustomerItemSheet;
    this.replace({ ...latest, items: Object.freeze(latest.items.filter(row => row.code !== item.code)),
      collapsingCodes: Object.freeze(latest.collapsingCodes.filter(code => code !== item.code)), activeCode: null });
  }
  requestRemove(generation = this.generation): void { if (this.controls(generation)) this.deps.controller.requestRemove(); }
  promptCurrent = (prompt: AdminCustomerDetailPrompt, generation = this.generation): boolean => this.current(generation) && !this.openingPrompt && this.deps.controller.getSnapshot().prompt === prompt;
  promptInteractive = (prompt: AdminCustomerDetailPrompt, generation = this.generation): boolean => this.interactive(generation) && !this.promptClosing() && this.promptCurrent(prompt, generation);
  choosePrompt(prompt: AdminCustomerDetailPrompt, confirmed: boolean, generation = this.generation): boolean {
    if (!this.promptInteractive(prompt, generation)) return false;
    this.closingPrompt = prompt; this.promptDecisions.set(prompt, confirmed); return true;
  }
  dismissPrompt(prompt: AdminCustomerDetailPrompt, generation = this.generation): void {
    if (!this.promptCurrent(prompt, generation) || this.claimedPrompts.has(prompt) || this.promptDecisions.get(prompt) === true) return;
    this.closingPrompt = null;
    this.claimedPrompts.add(prompt); const resolve = this.promptResults.get(prompt); this.promptResults.delete(prompt);
    this.deps.controller.dismissPrompt(prompt); resolve?.(false);
  }
  async confirmPrompt(prompt: AdminCustomerDetailPrompt, generation = this.generation): Promise<void> {
    if (!this.promptCurrent(prompt, generation) || this.claimedPrompts.has(prompt) || this.promptDecisions.get(prompt) !== true) return;
    this.closingPrompt = null;
    this.claimedPrompts.add(prompt); const resolve = this.promptResults.get(prompt);
    const success = await this.deps.controller.confirmRemove(prompt);
    this.promptResults.delete(prompt);
    if (prompt.kind === 'customer' && success && this.lifetimeCurrent(generation)) this.deps.onRemoved();
    resolve?.(success && this.lifetimeCurrent(generation));
  }
  back(generation = this.generation): boolean {
    if (!this.interactive(generation)) return false;
    if (this.openingPrompt || this.promptClosing()) return true;
    const prompt = this.deps.controller.getSnapshot().prompt;
    if (prompt) { this.dismissPrompt(prompt, generation); return true; }
    const sheet = this.state.sheets.at(-1); if (sheet) { this.dismissSheet(sheet.id, generation); return true; }
    return false;
  }
}
