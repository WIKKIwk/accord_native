import type { Session } from '../../auth';
import type { DispatchRecord, NotificationDetail } from '../notificationApi';
import { notificationCustomerRedirect, notificationDetailPolicy, trimNotificationText, type NotificationRole } from './notificationDetailModel';

export type NotificationDetailServices = {
  markSeen: (session: Session, receiptId: string) => Promise<void>;
  read: (session: Session, receiptId: string) => Promise<NotificationDetail>;
  comment: (session: Session, receiptId: string, message: string) => Promise<NotificationDetail>;
  respond: (session: Session, receiptId: string, approve: boolean, reason: string) => Promise<NotificationDetail>;
  recordDecision: (from: DispatchRecord['status'], to: DispatchRecord['status']) => void;
};
export type NotificationDetailCallbacks = {
  onCustomerDetail?: (receiptId: string) => void;
  onForeignReceipt: (message: string) => void;
  onNotice: (message: string) => void;
};
export type NotificationDetailState = {
  loading: boolean;
  error: unknown | null;
  detail: NotificationDetail | null;
  sending: boolean;
  comment: string;
};

/** Shared state and effects for V2's notification detail screen. */
export class NotificationDetailController {
  private state: NotificationDetailState = { loading: true, error: null, detail: null, sending: false, comment: '' };
  private readonly listeners = new Set<() => void>();
  private active = false;
  private generation = 0;
  private redirected = false;
  constructor(private readonly session: Session, readonly receiptId: string, readonly role: NotificationRole,
    private readonly services: NotificationDetailServices, private callbacks: NotificationDetailCallbacks,
    private readonly profileRef = typeof session.profile.ref === 'string' ? session.profile.ref : '') {}
  setCallbacks(callbacks: NotificationDetailCallbacks): void { this.callbacks = callbacks; }
  getSnapshot = (): NotificationDetailState => this.state;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  private set(patch: Partial<NotificationDetailState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
  start(): void {
    this.active = true;
    if (notificationCustomerRedirect(this.role, this.receiptId)) {
      if (!this.callbacks.onCustomerDetail) throw new Error('Customer detail destination is unavailable');
      if (!this.redirected) { this.redirected = true; this.callbacks.onCustomerDetail(this.receiptId); }
      return;
    }
    void this.reload();
  }
  stop(): void { this.active = false; this.generation++; }
  async reload(): Promise<void> {
    const generation = ++this.generation;
    this.set({ loading: true, error: null });
    try {
      await this.services.markSeen(this.session, this.receiptId);
      const detail = await this.services.read(this.session, this.receiptId);
      if (!this.active || generation !== this.generation) return;
      this.accept(detail);
    } catch (error) {
      if (this.active && generation === this.generation) this.set({ loading: false, error });
    }
  }
  setComment(comment: string): void { this.set({ comment }); }
  private policy() {
    return this.state.detail ? notificationDetailPolicy(this.role, this.profileRef, this.state.detail) : null;
  }
  private accept(detail: NotificationDetail): void {
    if (!notificationDetailPolicy(this.role, this.profileRef, detail).belongs) {
      this.set({ loading: false, detail: null });
      this.callbacks.onForeignReceipt('Bu receipt sizga tegishli emas.');
      return;
    }
    this.set({ loading: false, error: null, detail });
  }
  async sendComment(): Promise<void> {
    const message = trimNotificationText(this.state.comment);
    if (this.state.sending || !message || !this.policy()?.canWriteIssueComment) return;
    this.set({ sending: true });
    try {
      const detail = await this.services.comment(this.session, this.receiptId, message);
      if (this.active) { this.set({ comment: '' }); this.accept(detail); }
    } catch (error) {
      if (this.active) this.callbacks.onNotice(String(error).includes('forbidden')
        ? 'Bu receipt sizga tegishli emas.' : `Comment yuborilmadi: ${String(error)}`);
    } finally { if (this.active) this.set({ sending: false }); }
  }
  async acknowledge(): Promise<void> {
    if (this.state.sending || !this.policy()?.canAcknowledge) return;
    this.set({ sending: true });
    try {
      const detail = await this.services.comment(this.session, this.receiptId, 'Tasdiqlayman, shu holat bo‘lganini ko‘rdim.');
      if (this.active) this.accept(detail);
    } catch (error) {
      if (this.active) this.callbacks.onNotice(String(error).includes('forbidden')
        ? 'Bu receipt sizga tegishli emas.' : `Tasdiqlash yuborilmadi: ${String(error)}`);
    } finally { if (this.active) this.set({ sending: false }); }
  }
  async respond(approve: boolean, reason = ''): Promise<void> {
    if (this.state.sending || !this.state.detail || !this.policy()?.canRespond) return;
    const before = this.state.detail.record.status;
    this.set({ sending: true });
    try {
      const detail = await this.services.respond(this.session, this.receiptId, approve, trimNotificationText(reason));
      this.services.recordDecision(before, detail.record.status);
      if (this.active) this.accept(detail);
    } catch (error) {
      if (this.active) this.callbacks.onNotice(`Javob yuborilmadi: ${String(error)}`);
    } finally { if (this.active) this.set({ sending: false }); }
  }
}
