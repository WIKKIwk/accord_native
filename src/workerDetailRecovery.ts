const retryDelays = [200, 500, 1000, 2000];

type Options = {
  load: (current: () => boolean) => Promise<void>;
  current: () => boolean;
  hydrated: () => boolean;
  invalidate: () => void;
  failed: (error: unknown, initial: boolean) => void;
  denied: (error: unknown) => boolean;
  sectionsNeedRecovery?: () => boolean;
  schedule?: (run: () => void, delay: number) => ReturnType<typeof setTimeout>;
  cancel?: (timer: ReturnType<typeof setTimeout>) => void;
};

/** @v2 _AdminHydratedDetailHostState
 * Display/form ownership stays with the mounted sheet. This owner schedules reads only;
 * it never retains action authority or retries a production command.
 */
export class WorkerDetailRecovery {
  private generation = 0;
  private attempt = 0;
  private foreground = true;
  private blocked = false;
  private terminal = false;
  private disposed = false;
  private reading: number | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(private readonly options: Options) {}

  private cancel() {
    if (this.timer !== undefined) (this.options.cancel ?? clearTimeout)(this.timer);
    this.timer = undefined;
  }
  private eligible() {
    return !this.disposed && !this.terminal && this.foreground && !this.blocked && this.options.current();
  }
  private later(delay: number) {
    if (!this.eligible() || this.timer !== undefined) return;
    const generation = this.generation;
    this.timer = (this.options.schedule ?? setTimeout)(() => {
      this.timer = undefined;
      if (generation === this.generation) void this.read(generation);
    }, delay);
  }
  private async read(generation: number) {
    const current = () => generation === this.generation && this.eligible();
    if (!current()) return;
    this.reading = generation;
    try {
      await this.options.load(current);
      if (current()) {
        if (this.options.sectionsNeedRecovery?.()) this.recover(true);
        else this.attempt = 0;
      }
    } catch (error) {
      if (!current()) return;
      const initial = !this.options.hydrated();
      this.options.failed(error, initial);
      if (!initial && this.options.denied(error)) {
        this.terminal = true;
        this.cancel();
      } else if (!initial) {
        const delay = retryDelays[Math.min(this.attempt++, retryDelays.length - 1)];
        this.later(delay);
      }
    } finally { if (this.reading === generation) this.reading = null; }
  }
  /** A new list cursor/window or a completed command withdraws old authority. */
  invalidate(blocked = false) {
    this.generation++;
    this.cancel();
    this.blocked = blocked;
    this.attempt = 0;
    if (this.disposed || this.terminal) return;
    this.options.invalidate();
    this.later(0);
  }
  retry() {
    if (!this.terminal) this.invalidate(this.blocked);
  }
  /** @v2 _ReadOnlyOrderDetailSheetState._scheduleDetailRecovery */
  recover(afterRead = false) {
    if (this.timer !== undefined || !this.options.hydrated() || (!afterRead && this.reading === this.generation)) return;
    const delay = retryDelays[Math.min(this.attempt++, retryDelays.length - 1)];
    this.later(delay);
  }
  setForeground(value: boolean) {
    if (this.foreground === value) return;
    this.foreground = value;
    this.invalidate(this.blocked);
  }
  activate() {
    if (!this.disposed) return;
    this.disposed = false;
    this.invalidate(this.blocked);
  }
  reset() {
    this.terminal = false;
    this.invalidate(this.blocked);
  }
  dispose() {
    this.disposed = true;
    this.generation++;
    this.cancel();
  }
}
