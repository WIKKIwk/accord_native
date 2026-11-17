import type { AdminOwnedSheetAcceptedClose } from '../../modules/accord-admin-presentation/src/AccordAdminOwnedSheet';
import { isAdminOwnedSheetRetirementReceipt, type AdminOwnedSheetRetirementCapability, type AdminOwnedSheetRetirementRequest } from '../../modules/accord-admin-presentation/src/AccordAdminOwnedSheetRetirement';
import { createAdminRootSheetAuthority, type AdminRootSheetAuthority } from './AdminRootSheetAuthority';
import { createAdminPresentationWindowTicket } from './adminPresentationWindowTicket';
import type { AdminRootNativeParentBinding } from './adminRootNativeParentOwner';
import type { AdminRootPresentationChain, AdminRootPresentationEntry } from './adminRootPresentationChain';
import { AdminRootSheetLifecycle, type AdminRootSheetCancellationLease } from './adminRootSheetLifecycle';
import type { AdminRootSheetRequest } from './AdminRootSheetTypes';

/** One original Root record owns both the Source transaction and the separately retained native resource.
 * No timeout, React unmount, account change or close callback is a physical removal receipt.
 */
export class AdminRootSheetCoordinator {
  readonly lifecycle: AdminRootSheetLifecycle;
  private readonly authority: AdminRootSheetAuthority;
  private readonly retirement: AdminOwnedSheetRetirementRequest;
  private readonly cleanup: Extract<AdminOwnedSheetRetirementCapability, { status: 'available' }>;
  private lastAttempt: object | null = null;
  private disposed = false;
  private stopLifecycle: (() => void) | null = null;
  private readonly chain: AdminRootPresentationChain;
  private readonly entry: AdminRootPresentationEntry;
  private readonly identity: object;
  constructor(chain: AdminRootPresentationChain, entry: AdminRootPresentationEntry, identity: object, parent: AdminRootNativeParentBinding, request: AdminRootSheetRequest) {
    if (request.retirementCapability.status !== 'available') throw TypeError('Original sheet cleanup is required');
    this.chain = chain; this.entry = entry; this.identity = identity; this.cleanup = request.retirementCapability;
    this.retirement = Object.freeze({ presentationTicket: entry.id, parentTicket: parent.parent.id, retirementTicket: createAdminPresentationWindowTicket() });
    const original = Object.freeze({ presentationTicket: entry.id, parentTicket: parent.parent.id, nativeIdentity: identity });
    const authority = createAdminRootSheetAuthority(original, {
      subscribeSource: changed => {
        // Root subscribed the real owner at acceptance, including the queued-before-carrier lifetime.
        return chain.subscribeSource(changed);
      },
      subscribeResource: changed => {
        const stopRoot = chain.subscribeResource(changed);
        try {
          const stopParent = parent.subscribeResource(changed);
          if (typeof stopParent !== 'function') throw TypeError('Original parent cleanup is required');
          return () => { stopRoot(); stopParent(); };
        } catch (error) { stopRoot(); throw error; }
      },
    });
    if (!authority) throw TypeError('Subscribed original sheet authority is required');
    this.authority = authority;
    try {
      this.lifecycle = new AdminRootSheetLifecycle({ ...original, authority,
        isAccountCurrent: chain.current, isSourceCurrent: () => chain.isCurrent(entry),
        isNativeMember: () => chain.hasNativeLease(entry, identity), isOriginalParentCurrent: parent.isCurrent,
        hasNoDescendants: () => !chain.hasDescendants(entry),
        isReservedDescendantCurrent: candidate => chain.isReservedDescendant(entry, candidate),
        onNativeCancel: lease => request.onRequestClose(lease),
      });
    } catch (error) { authority.dispose(); throw error; }
  }
  attach = () => {
    if (this.disposed) return () => {};
    const stop = this.lifecycle.attach(); this.stopLifecycle = stop;
    return () => { stop(); if (this.stopLifecycle === stop) this.stopLifecycle = null; };
  };
  receive = (raw: unknown) => !this.disposed && this.lifecycle.receive(this.identity, raw);
  requestClose = (lease?: AdminRootSheetCancellationLease) => !this.disposed && this.lifecycle.requestClose(lease);
  acceptedClose = (): AdminOwnedSheetAcceptedClose | null => this.disposed ? null : this.lifecycle.acceptedCloseIntent();
  retire = () => { this.lifecycle.retire(); };
  /** Invoked by actual Root resource changes. A retry keeps the exact original ticket, never adopts a new module. */
  drain = () => {
    const { chain, entry, identity } = this;
    if (this.disposed || !chain.isRetiringSheet(entry, identity) || chain.hasDescendants(entry)) return;
    const stamp = chain.resourceStamp();
    if (this.lastAttempt === stamp) return; this.lastAttempt = stamp;
    void this.cleanup.retire(this.retirement).then(receipt => {
      if (this.disposed || !isAdminOwnedSheetRetirementReceipt(this.cleanup, receipt, this.retirement) ||
        !chain.isRetiringSheet(entry, identity) || chain.hasDescendants(entry) ||
        receipt.disposition === 'neverPresented' && this.lifecycle.getSnapshot().shown) return;
      chain.sheetResourceRemoved(entry, identity, receipt, this.cleanup, this.retirement);
    }).catch(() => { /* A failed bridge/native child guard retains the original resource for a later producer event. */ });
  };
  dispose = () => {
    if (this.disposed) return; this.disposed = true;
    this.stopLifecycle?.(); this.stopLifecycle = null; this.lifecycle.retire(); this.authority.dispose();
  };
}
