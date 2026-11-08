import { trimDart } from './qolipApiCommon';
import { normalizeQolipCellLabel, searchQolipCellLabels } from './qolipCellPickerLogic';
import { qolipGridLetters, qolipGridRowCount } from './qolipGridLogic';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';
import { QolipLocationChoiceLifetime } from './qolipLocationChoiceLifetime';

type Snapshot = {
  invalid: boolean;
  query: string;
  searching: boolean;
  selectedLetter: string;
  grid: readonly { label: string; excluded: boolean }[];
  results: readonly string[];
  primary: string | null;
  otherResults: readonly string[];
};
const invalid: Snapshot = { invalid: true, query: '', searching: false, selectedLetter: 'A', grid: [], results: [], primary: null, otherResults: [] };

/** Cell-picker choices only. No sheet opener, checkout return or placement dispatch is supplied. */
export class QolipGridCellPickerState {
  private readonly excluded: string | null;
  private readonly lifetime: QolipLocationChoiceLifetime;
  private readonly listeners = new Set<() => void>();
  private stopLifetime: (() => void) | null = null;
  private value: Snapshot;
  constructor(excludeCellLabel: string | null | undefined, boundary: QolipHomeReadBoundary) {
    this.excluded = excludeCellLabel == null ? null : trimDart(excludeCellLabel).toUpperCase();
    const initialLetter = this.excluded ? normalizeQolipCellLabel(this.excluded)?.[0] : undefined;
    this.lifetime = new QolipLocationChoiceLifetime(boundary);
    this.value = this.project('', initialLetter && qolipGridLetters.includes(initialLetter) ? initialLetter : 'A');
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = (): Snapshot => this.lifetime.getSnapshot() ? this.value : invalid;
  private notify() { for (const listener of [...this.listeners]) listener(); }
  private isExcluded(label: string): boolean { return this.excluded === trimDart(label).toUpperCase(); }
  private project(query: string, selectedLetter: string): Snapshot {
    const searching = !!trimDart(query), normalized = normalizeQolipCellLabel(query);
    const results = searchQolipCellLabels(query).filter(label => !this.isExcluded(label)).slice(0, 24);
    const primary = normalized !== null && results[0] === normalized ? normalized : null;
    return { invalid: false, query, searching, selectedLetter,
      grid: Array.from({ length: qolipGridRowCount }, (_, index) => {
        const label = `${selectedLetter}${index + 1}`; return { label, excluded: this.isExcluded(label) };
      }), results, primary, otherResults: results.filter(label => normalized === null || label !== normalized) };
  }
  activate() { this.stopLifetime ??= this.lifetime.subscribe(() => this.notify()); this.lifetime.activate(); }
  setQuery(query: string) {
    if (!this.lifetime.canChoose()) return;
    this.value = this.project(query, this.value.selectedLetter); this.notify();
  }
  selectLetter(letter: string) {
    if (!this.lifetime.canChoose() || !qolipGridLetters.includes(letter)) return;
    this.value = this.project(this.value.query, letter); this.notify();
  }
  gridChoice(label: string): string | null {
    if (!this.lifetime.canChoose() || this.value.searching || !this.value.grid.some(cell => cell.label === label && !cell.excluded)) return null;
    return label;
  }
  resultChoice(label: string): string | null {
    if (!this.lifetime.canChoose() || !this.value.searching || !this.value.results.includes(label)) return null;
    return label;
  }
  submit(): string | null {
    if (!this.lifetime.canChoose()) return null;
    const normalized = normalizeQolipCellLabel(this.value.query);
    return normalized && !this.isExcluded(normalized) ? normalized : null;
  }
  canChoose(): boolean { return this.lifetime.canChoose(); }
  suspend() { const stop = this.stopLifetime; this.stopLifetime = null; stop?.(); this.lifetime.suspend(); }
}
