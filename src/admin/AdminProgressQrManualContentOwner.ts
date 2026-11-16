import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { AdminProgressQrManualClose, AdminProgressQrManualContentProps, AdminProgressQrManualHost } from './AdminProgressQrManualContentTypes';

const hostKeys = ['surfaceIdentity', 'controller', 'ticket', 'buffer', 'isCurrent', 'canInteract', 'onCloseRequested'] as const;
/** @v2 _showManualQrDialog
 * Owns original content dispatch and one accepted result, never the page's persistent native input or native close ACK. */
export class AdminProgressQrManualContentLifetime {
  private readonly original: AdminProgressQrManualHost;
  private readonly members = new Set<object>(); private readonly listeners = new Set<() => void>();
  private close: AdminProgressQrManualClose | null = null; private retired = false; private checking = false;
  constructor(props: AdminProgressQrManualHost) {
    if (!props.surfaceIdentity || typeof props.surfaceIdentity !== 'object' || Array.isArray(props.surfaceIdentity) ||
      !props.buffer || typeof props.buffer.get !== 'function' || typeof props.buffer.set !== 'function' ||
      !props.controller || [props.controller.isManualCurrent, props.isCurrent, props.canInteract, props.onCloseRequested].some(value => typeof value !== 'function')) throw TypeError('Original QR manual host, issued ticket and persistent native page buffer are required');
    this.original = Object.freeze(Object.fromEntries(hostKeys.map(key => [key, props[key]]))) as AdminProgressQrManualHost;
  }
  matches = (props: AdminProgressQrManualHost) => hostKeys.every(key => props[key] === this.original[key]);
  commit = (props: AdminProgressQrManualHost) => { if (!this.matches(props)) this.retired = true; };
  attach = () => { const member = {}; this.members.add(member); return () => { this.members.delete(member); }; };
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.close !== null;
  readCurrent = () => {
    if (this.retired) return false;
    if (this.checking) { this.retired = true; return false; } this.checking = true;
    const { controller, ticket, isCurrent } = this.original;
    const valid = isSynchronouslyTrue(() => controller.isManualCurrent(ticket)) && isSynchronouslyTrue(isCurrent) && isSynchronouslyTrue(() => controller.isManualCurrent(ticket)); this.checking = false;
    if (!valid || this.retired) { this.retired = true; return false; } return true;
  };
  canInteract = () => {
    if (this.close || !this.members.size || !this.readCurrent()) return false;
    const allowed = isSynchronouslyTrue(this.original.canInteract);
    return allowed && this.readCurrent() && !this.close && this.members.size > 0;
  };
  submitValue = (rawValue: string) => { if (typeof rawValue === 'string') this.choose(rawValue); };
  submitBuffer = () => {
    if (!this.canInteract()) return;
    let value: unknown; try { value = this.original.buffer.get(); } catch { return; }
    if (typeof value === 'string') this.choose(value);
  };
  cancel = () => this.choose(null);
  private choose(rawValue: string | null) {
    if (!this.canInteract()) return;
    const close = Object.freeze({ rawValue }); this.close = close;
    for (const listener of [...this.listeners]) { try { listener(); } catch { /* An observer cannot replace this accepted result. */ } }
    // Removing content on accepted close is expected. Only the original surviving
    // native/account owner gets this result, and still owes a genuine close ACK.
    if (!this.readCurrent() || this.close !== close) return;
    try { void Promise.resolve(this.original.onCloseRequested(close)).catch(() => {}); } catch { /* Host failure does not authorize parsing or lookup. */ }
  }
}

export function useAdminProgressQrManualContent(props: AdminProgressQrManualContentProps) {
  if (typeof props.p !== 'function') throw TypeError('Original Source production text resolver is required');
  // A native surface cannot adopt another account, input, ticket or host callback.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lifetime = useMemo(() => new AdminProgressQrManualContentLifetime(props), [props.surfaceIdentity]);
  const closing = useSyncExternalStore(lifetime.subscribe, lifetime.getSnapshot, lifetime.getSnapshot);
  useSyncExternalStore(props.controller.subscribe, props.controller.getSnapshot, props.controller.getSnapshot);
  useLayoutEffect(() => lifetime.attach(), [lifetime]);
  useLayoutEffect(() => lifetime.commit(props));
  return { lifetime, closing, visible: lifetime.matches(props) && lifetime.readCurrent(),
    title: props.p('worker.scanner.manual.title'), label: props.p('worker.scanner.manual.payload'),
    cancelLabel: props.p('worker.action.cancel'), verifyLabel: props.p('worker.scanner.manual.verify'), hint: '4001...' };
}
