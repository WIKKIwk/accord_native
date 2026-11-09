import { resolveArchiveBatchDefaultCustomer, resolveExactArchiveBatchItemOption,
  type CustomerDirectoryEntry, type CustomerItemOption } from './werkaArchiveBatchQr';
import type { WerkaGuardEvaluator } from './werkaGuardTypes';

export type WerkaArchiveBatchLookupSnapshot =
  | Readonly<{ state: 'loading' | 'missing' }>
  | Readonly<{ state: 'resolved'; option: CustomerItemOption; customer: CustomerDirectoryEntry }>;

type Dependencies = {
  isCurrent: () => boolean;
  /** A verified synchronous account, scope, permission and generation evaluator is required. */
  evaluateGuard: WerkaGuardEvaluator;
  /** The eventual adapters must guard every send, retry, redirect and response decode. */
  loadOptions: (input: { query: string; limit: number }) => Promise<CustomerItemOption[]>;
  loadCustomers: (input: { itemCode: string; itemName: string; query: string; limit: number; offset: number }) => Promise<CustomerDirectoryEntry[]>;
  /** Synchronous, void-returning observer; asynchronous results fail closed. */
  onState: (snapshot: WerkaArchiveBatchLookupSnapshot) => void;
};

const copyOption = (value: CustomerItemOption): CustomerItemOption => {
  const result = { customerRef: value.customerRef, customerName: value.customerName, customerPhone: value.customerPhone,
    itemCode: value.itemCode, itemName: value.itemName, uom: value.uom, warehouse: value.warehouse };
  if (Object.values(result).some(field => typeof field !== 'string')) throw new TypeError('Invalid customer item option');
  return result;
};
const copyCustomer = (value: CustomerDirectoryEntry): CustomerDirectoryEntry => {
  const result = { ref: value.ref, name: value.name, phone: value.phone };
  if (Object.values(result).some(field => typeof field !== 'string')) throw new TypeError('Invalid customer');
  return result;
};
const copySnapshot = (value: WerkaArchiveBatchLookupSnapshot): WerkaArchiveBatchLookupSnapshot =>
  value.state === 'resolved' ? { state: value.state, option: copyOption(value.option), customer: copyCustomer(value.customer) }
    : { state: value.state };

/** Unwired lookup only. It neither opens the picker nor sends, retries or navigates. */
export class WerkaArchiveBatchLookupFlow {
  private state: WerkaArchiveBatchLookupSnapshot = { state: 'loading' };
  private started = false;
  private disposed = false;
  private evaluating = false;
  private generation = 0;

  constructor(private readonly itemName: string, private readonly deps: Dependencies) {
    if (typeof itemName !== 'string') throw new TypeError('Invalid batch item name');
    if (!deps || [deps.isCurrent, deps.evaluateGuard, deps.loadOptions, deps.loadCustomers, deps.onState]
      .some(value => typeof value !== 'function')) throw new TypeError('Batch lookup dependencies are required');
  }

  private current(): boolean {
    if (this.disposed || this.evaluating) return false;
    this.evaluating = true;
    try {
      const guard = this.deps.isCurrent, evaluate = this.deps.evaluateGuard;
      const result: unknown = evaluate(guard);
      if (result !== true) {
        if (result != null && (typeof result === 'object' || typeof result === 'function')) void Promise.resolve(result).catch(() => {});
        return false;
      }
      return !this.disposed && this.deps.isCurrent === guard && this.deps.evaluateGuard === evaluate;
    } catch { return false; }
    finally { this.evaluating = false; }
  }

  private valid(generation: number, options: Dependencies['loadOptions'], customers: Dependencies['loadCustomers'],
    onState: Dependencies['onState']): boolean {
    return generation === this.generation && this.current() && this.deps.loadOptions === options &&
      this.deps.loadCustomers === customers && this.deps.onState === onState;
  }

  getSnapshot(): WerkaArchiveBatchLookupSnapshot | null { return this.current() ? copySnapshot(this.state) : null; }

  private publish(next: WerkaArchiveBatchLookupSnapshot): boolean {
    if (!this.current()) return false;
    const onState = this.deps.onState;
    this.state = next;
    if (!this.current() || this.deps.onState !== onState) return false;
    try {
      const result: unknown = onState(copySnapshot(next));
      if (result != null && (typeof result === 'object' || typeof result === 'function')) {
        void Promise.resolve(result).catch(() => {}); return false;
      }
    } catch { return false; }
    return this.current() && this.deps.onState === onState;
  }

  async start(): Promise<void> {
    if (this.started || !this.current()) return;
    this.started = true;
    const generation = ++this.generation, options = this.deps.loadOptions,
      customers = this.deps.loadCustomers, onState = this.deps.onState;
    const valid = () => this.valid(generation, options, customers, onState);
    if (!this.publish({ state: 'loading' }) || !valid()) return;
    try {
      const found = await options({ query: this.itemName, limit: 200 });
      if (!valid()) return;
      const matched = resolveExactArchiveBatchItemOption(this.itemName, found);
      if (!valid()) return;
      if (matched === null) { this.publish({ state: 'missing' }); return; }
      const option = copyOption(matched);
      if (!valid()) return;
      let entries: CustomerDirectoryEntry[];
      try {
        entries = await customers({ itemCode: option.itemCode, itemName: option.itemName, query: '', limit: 200, offset: 0 });
      } catch {
        if (!valid()) return;
        entries = [];
      }
      if (!valid()) return;
      const customer = copyCustomer(resolveArchiveBatchDefaultCustomer(option, entries));
      if (valid()) this.publish({ state: 'resolved', option, customer });
    } catch {
      if (valid()) this.publish({ state: 'missing' });
    }
  }

  dispose(): void { this.disposed = true; this.generation++; }
}
