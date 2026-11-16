import { requireOptionalNativeModule } from 'expo';

/** This protocol proves native window-tree detachment; it does not prove compositor animation end. */
export const adminPresentationWindowGuarantee = 'window-tree-detach' as const;
export type AdminPresentationWindowReceipt = Readonly<{
  protocol: 1; guarantee: typeof adminPresentationWindowGuarantee; handle: string; ticket: string; viewTag: number; state: 'armed';
}>;
export type AdminPresentationWindowDetached = Readonly<Omit<AdminPresentationWindowReceipt, 'state'> & { state: 'detached' }>;
export type AdminPresentationWindowObserver = Readonly<{
  /** Marker must be a real, non-collapsed RN view INSIDE the intended native window, with nativeID=ticket. */
  arm: (viewTag: number, ticket: string) => Promise<AdminPresentationWindowReceipt>;
  waitForDetach: (receipt: AdminPresentationWindowReceipt) => Promise<AdminPresentationWindowDetached>;
  cancelPending: (ticket: string) => Promise<boolean>;
  cancel: (receipt: AdminPresentationWindowReceipt) => Promise<boolean>;
}>;
export type AdminPresentationWindowCapability =
  | Readonly<{ status: 'unavailable' }>
  | Readonly<{ status: 'available'; observer: AdminPresentationWindowObserver }>;
type NativeObserver = { capabilities: () => Promise<unknown>; arm: (viewTag: number, ticket: string) => Promise<unknown>;
  waitForDetach: (handle: string, ticket: string) => Promise<unknown>; cancelPending: (ticket: string) => Promise<unknown>; cancel: (handle: string, ticket: string) => Promise<unknown> };
const id = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9:._-]{0,159}$/.test(value);
const tag = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 2_147_483_647;
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw TypeError('Invalid presentation window receipt'); return value as Record<string, unknown>;
};
function receipt(value: unknown, expectedTicket: string, expectedTag: number, state: 'armed' | 'detached', handle?: string) {
  const row = object(value);
  if (row.protocol !== 1 || row.guarantee !== adminPresentationWindowGuarantee || row.state !== state || !id(row.handle) || row.ticket !== expectedTicket || row.viewTag !== expectedTag || handle !== undefined && row.handle !== handle) throw TypeError('Presentation window identity changed');
  return Object.freeze({ protocol: 1 as const, guarantee: adminPresentationWindowGuarantee, handle: row.handle, ticket: expectedTicket, viewTag: expectedTag, state });
}
const boolean = (value: unknown) => { if (typeof value !== 'boolean') throw TypeError('Invalid presentation cancellation reply'); return value; };
const unavailable: AdminPresentationWindowCapability = Object.freeze({ status: 'unavailable' });

/** Availability is a native protocol capability, never a claim that a presenter/window is mounted or ready.
 * The JS consumer still owns account, mounted lifetime, dialog ID, accepted-close and closing checks.
 * Native receipts are accepted only from this captured module/observer and cannot be reconstructed.
 */
export async function readAdminPresentationWindowCapability(platform: string): Promise<AdminPresentationWindowCapability> {
  if (platform !== 'android') return unavailable;
  let native: NativeObserver;
  try {
    const module = requireOptionalNativeModule<NativeObserver>('AccordAdminPresentation');
    if (!module || !['capabilities', 'arm', 'waitForDetach', 'cancelPending', 'cancel'].every(key => typeof module[key as keyof NativeObserver] === 'function')) return unavailable;
    const value = object(await module.capabilities());
    if (value.protocol !== 1 || value.platform !== 'android' || value.guarantee !== adminPresentationWindowGuarantee) return unavailable;
    native = module;
  } catch { return unavailable; }
  const issued = new WeakSet<AdminPresentationWindowReceipt>(), waiting = new WeakSet<AdminPresentationWindowReceipt>();
  const check = (value: AdminPresentationWindowReceipt) => { if (!value || !issued.has(value)) throw TypeError('Presentation window receipt is not original'); };
  const observer: AdminPresentationWindowObserver = Object.freeze({
    arm: async (viewTag, ticket) => {
      if (!tag(viewTag) || !id(ticket)) throw TypeError('Invalid presentation marker');
      const value = receipt(await native.arm(viewTag, ticket), ticket, viewTag, 'armed') as AdminPresentationWindowReceipt; issued.add(value); return value;
    },
    waitForDetach: async value => {
      check(value); if (waiting.has(value)) throw Error('Presentation window already has a pending wait'); waiting.add(value);
      try {
        const raw = await native.waitForDetach(value.handle, value.ticket); check(value);
        return receipt(raw, value.ticket, value.viewTag, 'detached', value.handle) as AdminPresentationWindowDetached;
      } finally { waiting.delete(value); issued.delete(value); }
    },
    cancelPending: async ticket => { if (!id(ticket)) throw TypeError('Invalid presentation ticket'); return boolean(await native.cancelPending(ticket)); },
    cancel: async value => { check(value); try { return boolean(await native.cancel(value.handle, value.ticket)); } finally { issued.delete(value); } },
  });
  return Object.freeze({ status: 'available', observer });
}
