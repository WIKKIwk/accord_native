import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { AdminFixedSnackBarController } from './adminFixedSnackBarController';
import type { AdminFixedSnackBarGeometry } from './adminFixedSnackBarGeometry';
import type { AdminFixedSnackBarEntry, AdminFixedSnackBarHost } from './adminFixedSnackBarModel';

type Receipt = { host: AdminFixedSnackBarHost; entry: AdminFixedSnackBarEntry; geometry: AdminFixedSnackBarGeometry; height: number; current: () => boolean; expired: boolean; checking: boolean };
/** Native layout receipts gate the entry controller; a paired window alone does not prove the message has been laid out. */
export class AdminFixedSnackBarNativeReadiness {
  private revision = 0; private readonly receipts = new Map<object, Receipt>(); private readonly listeners = new Set<() => void>();
  constructor(private readonly queue: AdminFixedSnackBarController) {}
  getSnapshot = () => this.revision;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish() { this.revision++; for (const listener of [...this.listeners]) { try { listener(); } catch { /* A subscriber is not an animation/layout acknowledgement. */ } } }
  private current(receipt: Receipt): boolean {
    if (receipt.expired) return false; if (receipt.checking) { receipt.expired = true; return false; } receipt.checking = true;
    const current = isSynchronouslyTrue(receipt.current); receipt.checking = false;
    if (!current || receipt.expired || this.queue.entryFor(receipt.host) !== receipt.entry) { receipt.expired = true; return false; }
    const next = this.queue.geometryFor(receipt.host), old = receipt.geometry;
    // A keyboard/contentBottom translation does not change the already measured text layout.
    return next !== null && next.windowIdentity === old.windowIdentity && next.width === old.width && next.safeLeft === old.safeLeft && next.safeRight === old.safeRight && this.queue.entryFor(receipt.host) === receipt.entry;
  }
  measured(identity: object, options: Readonly<Omit<Receipt, 'expired' | 'checking'>>): boolean {
    if (!Number.isFinite(options.height) || options.height <= 0) return false;
    const previous = this.receipts.get(identity);
    if (previous && previous.host === options.host && previous.entry === options.entry && previous.height === options.height && this.current(previous)) return true;
    const receipt = { ...options, expired: false, checking: false }; if (!this.current(receipt)) return false;
    this.receipts.set(identity, receipt); this.publish(); return this.receipts.get(identity) === receipt && this.current(receipt);
  }
  forget(identity: object): void { if (this.receipts.delete(identity)) this.publish(); }
  receiptFor(entry: AdminFixedSnackBarEntry): object | null { return [...this.receipts.values()].find(receipt => receipt.entry === entry && this.current(receipt)) ?? null; }
  has(entry: AdminFixedSnackBarEntry): boolean { return this.receiptFor(entry) !== null; }
}
