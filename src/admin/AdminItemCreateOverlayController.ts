import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { AdminItemCreateDialog } from './adminItemCreateFormController';
import type { AdminItemCreateMovePrompt } from './adminItemCreateListController';
import type { AdminItemCreateScreenModel } from './useAdminItemCreate';

type Owner = AdminItemCreateScreenModel['owner'];
export type AdminItemCreatePresentedDialog = Readonly<{ identity: object; dialog: AdminItemCreateDialog }>;
export type AdminItemCreatePresentedMove = Readonly<{ identity: object; prompt: AdminItemCreateMovePrompt }>;
type Snapshot = Readonly<{ create: AdminItemCreatePresentedDialog | null; move: AdminItemCreatePresentedMove | null; createVisible: boolean; moveVisible: boolean }>;
/** Native presentation lifetime: retains original closing content until a genuine native completion event. */
export class AdminItemCreateOverlayController {
  private state: Snapshot = { create: null, move: null, createVisible: false, moveVisible: false }; private readonly listeners = new Set<() => void>();
  private active = false; private retired = false; private publishing = false; private handling = false; private checking = false; private unsubscribe: (() => void) | null = null;
  private accepted: { identity: object; commit: () => Promise<void> } | null = null; private settling: object | null = null;
  constructor(private readonly owner: Owner, private readonly authority: () => boolean, private readonly nativeCurrent: () => boolean) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private current() { if (!this.active || this.retired) return false; if (this.checking) { this.retired = true; return false; } this.checking = true;
    try { if (!isSynchronouslyTrue(this.authority)) this.retired = true; return !this.retired && this.active; } finally { this.checking = false; } }
  private publish(patch: Partial<Snapshot>) { this.state = { ...this.state, ...patch }; const previous = this.publishing; this.publishing = true;
    try { for (const listener of [...this.listeners]) listener(); } finally { this.publishing = previous; } }
  start() { if (this.active || this.retired) return; this.active = true; this.unsubscribe = this.owner.controller.subscribe(this.update); this.update(); }
  private update = () => {
    if (!this.current()) { this.accepted = null; this.publish({ create: null, move: null, createVisible: false, moveVisible: false }); return; }
    const source = this.owner.controller.getSnapshot(), dialog = source.form.dialog, prompt = source.list.prompt;
    let create = this.state.create, move = this.state.move;
    if (dialog) create = create?.dialog === dialog ? create : Object.freeze({ identity: create?.dialog.id === dialog.id && create.dialog.generation === dialog.generation ? create.identity : Object.freeze({}), dialog });
    else if (!source.closingDialog || source.closingDialog.id !== create?.dialog.id) create = null;
    if (prompt && prompt !== move?.prompt) move = Object.freeze({ identity: Object.freeze({}), prompt });
    const createVisible = dialog !== null && create?.dialog.id === dialog.id, moveVisible = prompt !== null && move?.prompt === prompt;
    if (create !== this.state.create || move !== this.state.move || createVisible !== this.state.createVisible || moveVisible !== this.state.moveVisible) this.publish({ create, move, createVisible, moveVisible });
  };
  completeCreate(ticket: AdminItemCreatePresentedDialog) {
    if (this.publishing || this.handling || this.state.create?.identity !== ticket.identity || this.state.createVisible || !this.current()) return;
    const closing = this.owner.controller.getSnapshot().closingDialog; if (closing?.id !== ticket.dialog.id || closing.generation !== ticket.dialog.generation) return;
    this.publish({ create: null, createVisible: false }); if (this.current()) this.owner.controller.completeDialog(ticket.dialog.id);
  }
  chooseMove(ticket: AdminItemCreatePresentedMove, confirmed: boolean) {
    if (this.publishing || this.handling || this.settling === ticket.identity || this.state.move !== ticket || !this.state.moveVisible) return;
    this.handling = true;
    try { if (!this.current() || !isSynchronouslyTrue(this.nativeCurrent) || !this.current()) return; this.settling = ticket.identity;
      const commit = this.owner.controller.list.chooseMove(ticket.prompt, confirmed); this.accepted = typeof commit === 'function' ? { identity: ticket.identity, commit } : null; }
    finally { this.handling = false; }
  }
  async completeMove(ticket: AdminItemCreatePresentedMove) {
    if (this.publishing || this.handling || this.state.move !== ticket || this.state.moveVisible || !this.current()) return;
    const original = this.accepted; this.accepted = null; this.publish({ move: null, moveVisible: false });
    if (original?.identity === ticket.identity && this.current()) await original.commit();
  }
  dispose() { this.active = false; this.unsubscribe?.(); this.unsubscribe = null; this.accepted = null; this.settling = null; this.publish({ create: null, move: null, createVisible: false, moveVisible: false }); }
}
