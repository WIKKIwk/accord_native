import type { AdminReliableScannerCoordinator } from './adminReliableScannerCoordinator';
import { adminReliableScannerCompletion, adminReliableScannerDriver, adminReliableScannerReleaseTimeout, adminReliableScannerStartTimeout, adminReliableScannerState, adminReliableScannerTimeout,
  type AdminReliableScannerCapture, type AdminReliableScannerDetectionError, type AdminReliableScannerDriver, type AdminReliableScannerPhase, type AdminReliableScannerReporter, type AdminReliableScannerSnapshot, type AdminReliableScannerTimers, type AdminReliableScannerTorchReceipt } from './adminReliableScannerModel';

/** @v2 ReliableScannerSession
 * The real view attaches its ordered capture listener BEFORE attach(). No camera/native adapter is fabricated here. */
export class AdminReliableScannerSession {
  private readonly driver: AdminReliableScannerDriver; private readonly timers: AdminReliableScannerTimers;
  private readonly listeners = new Set<() => void>(); private snapshot: AdminReliableScannerSnapshot = Object.freeze({ phase: 'idle', lastError: null, recoveryCount: 0, disposed: false });
  private attached = false; private routeVisible = true; private appResumed = true; private requested = true;
  private driverDisposed = false; private listenersDisposed = false; private detectionRecoveryInFlight = false;
  /** Internal coordinator fields; consumers change lifetime through attach/detach/stop/dispose. */
  coordinatorPriority = 0; forceRestart = false;
  constructor(driver: AdminReliableScannerDriver, private readonly coordinator: AdminReliableScannerCoordinator, private readonly reportError: AdminReliableScannerReporter,
    timers: AdminReliableScannerTimers = { set: setTimeout, clear: clearTimeout }) {
    if (!coordinator || typeof coordinator.reconcile !== 'function' || typeof reportError !== 'function' || typeof timers.set !== 'function' || typeof timers.clear !== 'function') throw TypeError('Original scanner coordinator, reporter and timers are required');
    this.driver = adminReliableScannerDriver(driver); this.timers = timers;
  }
  get phase() { return this.snapshot.phase; } get lastError() { return this.snapshot.lastError; } get recoveryCount() { return this.snapshot.recoveryCount; } get disposed() { return this.snapshot.disposed; }
  get settled() { return this.coordinator.settled; }
  get shouldRun() { return !this.disposed && this.attached && this.routeVisible && this.appResumed && this.requested; }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { if (!this.listenersDisposed) this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<AdminReliableScannerSnapshot>) { this.snapshot = Object.freeze({ ...this.snapshot, ...patch }); }
  /** Internal Source notifier policy: error/recovery field changes alone do not emit a new phase. */
  setPhase(phase: AdminReliableScannerPhase): void {
    if (this.phase === phase) return; this.update({ phase });
    if (!this.listenersDisposed) for (const listener of [...this.listeners]) { try { listener(); } catch { /* A render observer is not a native receipt. */ } }
  }
  attach(): Promise<void> { if (this.disposed) return Promise.resolve(); this.attached = true; return this.coordinator.reconcile(this, true); }
  detach(): Promise<void> { if (this.disposed) return this.coordinator.settled; this.attached = false; return this.coordinator.reconcile(this); }
  setRouteVisible(visible: boolean): Promise<void> { if (this.disposed || this.routeVisible === visible) return Promise.resolve(); this.routeVisible = visible; if (visible) this.forceRestart = true; return this.coordinator.reconcile(this, visible); }
  setAppResumed(resumed: boolean): Promise<void> { if (this.disposed || this.appResumed === resumed) return Promise.resolve(); this.appResumed = resumed; if (resumed) this.forceRestart = true; return this.coordinator.reconcile(this, resumed); }
  async start(forceRestart = false): Promise<boolean> { if (this.disposed) return false; this.requested = true; this.forceRestart ||= forceRestart; await this.coordinator.reconcile(this, true); return this.phase === 'running'; }
  stop(): Promise<void> { if (this.disposed) return this.coordinator.settled; this.requested = false; return this.coordinator.reconcile(this); }
  retry(): Promise<boolean> { return this.start(true); }
  async dispose(): Promise<void> {
    if (this.disposed) { await this.coordinator.settled; return; } this.update({ disposed: true }); this.requested = false; await this.coordinator.reconcile(this); this.listenersDisposed = true; this.listeners.clear();
  }
  nativeState = () => adminReliableScannerState(this.driver);
  private originalRun(receipt: Readonly<{ nativeIdentity: object; runIdentity: object }>): boolean {
    if (this.disposed || !receipt || receipt.nativeIdentity !== this.driver.nativeIdentity) return false;
    const state = this.nativeState(); return !this.disposed && state.runIdentity !== null && state.runIdentity === receipt.runIdentity;
  }
  /** View wiring calls these before attach; data errors and actual hardware state are separate native event receipts. */
  subscribeCaptures(listener: (receipt: AdminReliableScannerCapture) => void): () => void {
    let active = true, stop: () => void;
    try { stop = this.driver.subscribeCaptures(receipt => { if (active && this.originalRun(receipt) && active) listener(receipt); }); if (typeof stop !== 'function') throw TypeError('Original capture subscription cleanup is required'); }
    catch (error) { active = false; throw error; } return () => { if (active) { active = false; stop(); } };
  }
  subscribeDetectionErrors(): () => void {
    let active = true, stop: () => void;
    try { stop = this.driver.subscribeDetectionErrors(receipt => { if (active && this.originalRun(receipt) && active) this.handleDetectionError(receipt); }); if (typeof stop !== 'function') throw TypeError('Original detection-error subscription cleanup is required'); }
    catch (error) { active = false; throw error; } return () => { if (active) { active = false; stop(); } };
  }
  subscribeTorch(listener: (receipt: AdminReliableScannerTorchReceipt) => void): () => void {
    let active = true, stop: () => void;
    try { stop = this.driver.subscribeTorch(receipt => { if (active && this.originalRun(receipt) && active) listener(receipt); }); if (typeof stop !== 'function') throw TypeError('Original torch subscription cleanup is required'); }
    catch (error) { active = false; throw error; } return () => { if (active) { active = false; stop(); } };
  }
  async toggleTorch(): Promise<AdminReliableScannerTorchReceipt | null> {
    if (this.disposed) return null; const state = this.nativeState(); if (this.disposed || !state.initialized || !state.isRunning || state.torch === 'unavailable') return null;
    const receipt = await this.driver.toggleTorch(); return receipt.runIdentity === state.runIdentity && this.originalRun(receipt) ? receipt : null;
  }
  handleDetectionError(receipt: AdminReliableScannerDetectionError): void {
    if (!this.originalRun(receipt)) return; this.update({ lastError: receipt.error });
    try { const result: unknown = this.reportError(receipt.error, 'detection'); if (result && typeof (result as PromiseLike<unknown>).then === 'function') void Promise.resolve(result).catch(() => {}); } catch { /* Source error reporter cannot prevent recovery. */ }
    if (this.detectionRecoveryInFlight) return; this.detectionRecoveryInFlight = true;
    void this.retry().finally(() => { this.detectionRecoveryInFlight = false; });
  }
  /** Internal coordinator start. A start timeout never cancels/acknowledges the native operation. */
  async startDriver(forceRestart: boolean): Promise<boolean> {
    if (this.disposed || !this.shouldRun) return false;
    if (this.nativeState().isRunning && !forceRestart) { this.update({ lastError: null }); this.setPhase('running'); return true; }
    let startError: unknown | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (this.disposed || !this.shouldRun) return false;
      if (forceRestart && this.nativeState().isRunning || attempt > 0) await this.safeStopDriver();
      this.setPhase(attempt === 0 ? 'starting' : 'recovering');
      try {
        const operation = this.driver.start();
        // Observe a rejected native promise even if reading its state throws.
        void operation.catch(() => {});
        const receipt = this.nativeState().hasCameraPermission ? await adminReliableScannerTimeout(operation, adminReliableScannerStartTimeout, this.timers) : await operation;
        adminReliableScannerCompletion(this.driver, 'start', receipt);
        if (this.nativeState().isRunning) { this.update({ lastError: null }); this.setPhase('running'); return true; }
        startError = this.nativeState().error ?? new Error('Scanner start completed without a running camera.');
      } catch (error) { startError = error; }
      if (attempt === 0) this.update({ recoveryCount: this.recoveryCount + 1 });
    }
    this.update({ lastError: startError ?? new Error('Scanner failed to start.') }); this.setPhase('error'); return false;
  }
  async stopDriver(): Promise<void> { if (this.driverDisposed) return; this.setPhase('stopping'); await this.safeStopDriver(); if (!this.disposed && this.phase !== 'error') this.setPhase('suspended'); }
  private async safeStopDriver(): Promise<void> {
    try { const receipt = await adminReliableScannerTimeout(this.driver.stop(), adminReliableScannerReleaseTimeout, this.timers); adminReliableScannerCompletion(this.driver, 'stop', receipt); }
    catch (error) { this.update({ lastError: error }); }
  }
  async disposeDriver(): Promise<void> {
    if (this.driverDisposed) return; this.driverDisposed = true;
    try { const receipt = await adminReliableScannerTimeout(this.driver.dispose(), adminReliableScannerReleaseTimeout, this.timers); adminReliableScannerCompletion(this.driver, 'dispose', receipt); }
    catch (error) { this.update({ lastError: error }); }
    this.setPhase('disposed');
  }
  recordCoordinatorError(error: unknown): void { this.update({ lastError: error }); this.setPhase('error'); }
}
