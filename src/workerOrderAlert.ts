import type { OrderAlertKind } from './workerControlsApi';
/** @v2 _OrderAlertButtonState */
export class WorkerOrderAlertState {
  sending = false;
  sent = false;
  errorCode: string | null = null;
  constructor(readonly requestId: string, private readonly sendRequest: (id: string) => Promise<void>, private readonly current: () => boolean,
    private readonly enabled: () => boolean, private readonly changed: () => void) {}
  async send() {
    if (!this.current() || !this.enabled() || this.sending || this.sent) return;
    this.sending = true; this.errorCode = null; this.changed();
    try { await this.sendRequest(this.requestId); if (this.current()) this.sent = true; }
    catch (error) { if (this.current()) this.errorCode = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'order_alert_send_failed'; }
    finally { if (this.current()) { this.sending = false; this.changed(); } }
  }
  label(kind: OrderAlertKind) { return this.sent ? 'worker.alert.sent' : this.sending ? 'worker.alert.sending' : kind === 'rawMaterial' ? 'worker.alert.material' : 'worker.alert.qolip'; }
  get errorKey() { return this.errorCode === 'order_alert_no_recipients' ? 'worker.alert.no_recipients' : this.errorCode === 'order_alert_test_mode' ? 'worker.alert.test_mode' : 'worker.alert.failed'; }
}
