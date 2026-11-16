import { createAdminPresentationWindowTicket } from './adminPresentationWindowTicket';

export type AdminFixedSnackBarMembership = Readonly<{ identity: object; ticket: string }>;
/** A real native-host effect lease. Cleanup/replay publishes a fresh opaque member, so retained native callbacks cannot adopt it. */
export class AdminFixedSnackBarMembershipOwner {
  constructor(private readonly identity: object) {}
  private member: AdminFixedSnackBarMembership | null = null;
  private readonly listeners = new Set<() => void>();
  getSnapshot = () => this.member;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish() { for (const listener of [...this.listeners]) { try { listener(); } catch { /* A render observer cannot change a native-host lease. */ } } }
  attach(): () => void {
    const original = Object.freeze({ identity: this.identity, ticket: createAdminPresentationWindowTicket() }); this.member = original; this.publish(); let detached = false;
    return () => { if (detached) return; detached = true; if (this.member === original) { this.member = null; this.publish(); } };
  }
  current(original: AdminFixedSnackBarMembership | null): boolean { return original !== null && this.member === original; }
}
