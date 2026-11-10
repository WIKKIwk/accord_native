/** Native modal transitions complete on native events, not React state updates. */
export class WorkerReportModalFlow {
  private visible = true;
  private disposed = false;
  private shown: Promise<void>;
  private showComplete: (() => void) | null = null;
  private dismissComplete: (() => void) | null = null;
  private hiding: Promise<void> | null = null;
  constructor(private nativeEvents: boolean, private visibility: (hidden: boolean) => void) {
    this.shown = nativeEvents ? new Promise(resolve => { this.showComplete = resolve; }) : Promise.resolve();
  }
  didShow() { this.showComplete?.(); this.showComplete = null; }
  didDismiss() { this.dismissComplete?.(); this.dismissComplete = null; }
  hide(): Promise<void> {
    if (this.hiding) return this.hiding;
    if (!this.visible || this.disposed) return Promise.resolve();
    const transition = this.hidePresented();
    this.hiding = transition;
    void transition.finally(() => { if (this.hiding === transition) this.hiding = null; });
    return transition;
  }
  private async hidePresented() {
    await this.shown;
    if (this.disposed) return;
    this.visible = false;
    const dismissed = this.nativeEvents ? new Promise<void>(resolve => { this.dismissComplete = resolve; }) : Promise.resolve();
    this.visibility(true);
    await dismissed;
  }
  show() {
    if (this.disposed || this.visible) return;
    this.visible = true;
    this.shown = this.nativeEvents ? new Promise(resolve => { this.showComplete = resolve; }) : Promise.resolve();
    this.visibility(false);
  }
  dispose() { this.disposed = true; this.didShow(); this.didDismiss(); }
}
