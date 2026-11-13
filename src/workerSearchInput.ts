import { workerQueueSearch } from './workerQueueWindow';

/** Keep native text edits separate from the worker queue's V2 search window. */
export class WorkerSearchInput {
  private text: string;
  private query: string;
  private readonly textListeners = new Set<() => void>();
  private readonly queryListeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(initial = '') {
    this.text = initial;
    this.query = workerQueueSearch(initial);
  }

  readonly getText = (): string => this.text;
  readonly getQuery = (): string => this.query;
  readonly subscribeText = (listener: () => void) => {
    this.textListeners.add(listener);
    return () => { this.textListeners.delete(listener); };
  };
  readonly subscribeQuery = (listener: () => void) => {
    this.queryListeners.add(listener);
    return () => { this.queryListeners.delete(listener); };
  };

  readonly change = (raw: string): void => {
    if (raw === this.text) return;
    this.text = raw;
    this.cancelPending();
    this.timer = setTimeout(() => {
      this.timer = undefined;
      const query = workerQueueSearch(this.text);
      if (query === this.query) return;
      this.query = query;
      for (const listener of this.queryListeners) listener();
    }, 350);
    for (const listener of this.textListeners) listener();
  };

  cancelPending(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }
}
