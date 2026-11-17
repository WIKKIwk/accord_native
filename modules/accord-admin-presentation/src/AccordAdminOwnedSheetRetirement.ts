import { adminOwnedSheetOriginalModule, type AdminOwnedSheetPlatform } from './AccordAdminOwnedSheet';

export type AdminOwnedSheetRetirementRequest = Readonly<{ presentationTicket: string; parentTicket: string; retirementTicket: string }>;
export type AdminOwnedSheetRetirementReceipt = AdminOwnedSheetRetirementRequest & Readonly<{
  protocol: 1; platform: AdminOwnedSheetPlatform; receiptID: string; disposition: 'removed' | 'neverPresented';
}>;
type Available = Readonly<{
  status: 'available'; platform: AdminOwnedSheetPlatform;
  /** Resource work only. Actual Root must first prove zero registered descendants, including queued children.
   * An account/Source retirement is permitted; this NEVER accepts a Source close or returns its result.
   * A duplicate pending original request calls native again to retry its genuine child/resource guard.
   */
  retire: (request: AdminOwnedSheetRetirementRequest) => Promise<AdminOwnedSheetRetirementReceipt>;
}>;
export type AdminOwnedSheetRetirementCapability = Readonly<{ status: 'unavailable' }> | Available;
const unavailable: AdminOwnedSheetRetirementCapability = Object.freeze({ status: 'unavailable' });
const issued = new WeakSet<object>();
const cache = new WeakMap<object, Promise<AdminOwnedSheetRetirementCapability>>();
const receipts = new WeakMap<object, Readonly<{ capability: Available; request: AdminOwnedSheetRetirementRequest }>>();
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const ticket = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9:._-]{0,159}$/.exec(value)?.[0] === value;
const receiptID = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.exec(value)?.[0] === value;
function captureRequest(value: unknown): AdminOwnedSheetRetirementRequest | null {
  try {
    if (!object(value)) return null;
    const { presentationTicket, parentTicket, retirementTicket } = value;
    return ticket(presentationTicket) && ticket(parentTicket) && ticket(retirementTicket) && new Set([presentationTicket, parentTicket, retirementTicket]).size === 3
      ? Object.freeze({ presentationTicket, parentTicket, retirementTicket }) : null;
  } catch { return null; }
}
function same(a: AdminOwnedSheetRetirementRequest, b: AdminOwnedSheetRetirementRequest) {
  return a.presentationTicket === b.presentationTicket && a.parentTicket === b.parentTicket && a.retirementTicket === b.retirementTicket;
}
function captureReceipt(value: unknown, platform: AdminOwnedSheetPlatform, original: AdminOwnedSheetRetirementRequest): AdminOwnedSheetRetirementReceipt | null {
  try {
    if (!object(value)) return null;
    const { protocol, platform: actualPlatform, presentationTicket, parentTicket, retirementTicket, receiptID: nativeReceiptID, disposition } = value;
    if (protocol !== 1 || actualPlatform !== platform || presentationTicket !== original.presentationTicket || parentTicket !== original.parentTicket || retirementTicket !== original.retirementTicket ||
      !receiptID(nativeReceiptID) || [presentationTicket, parentTicket, retirementTicket].includes(nativeReceiptID) || disposition !== 'removed' && disposition !== 'neverPresented') return null;
    return Object.freeze({ protocol: 1, platform, ...original, receiptID: nativeReceiptID, disposition });
  } catch { return null; }
}
async function bind(original: NonNullable<ReturnType<typeof adminOwnedSheetOriginalModule>>): Promise<AdminOwnedSheetRetirementCapability> {
  try {
    const native = original.native, read = original.readRetirement, retire = original.retireSheet;
    if (typeof read !== 'function' || typeof retire !== 'function') return unavailable;
    const reply = await read.call(native);
    if (!object(reply) || reply.protocol !== 1 || reply.platform !== original.platform || reply.guarantee !== 'owned-original-sheet-retirement') return unavailable;
    const requests = new Map<string, { request: AdminOwnedSheetRetirementRequest; receipt: AdminOwnedSheetRetirementReceipt | null }>();
    const retirementOwners = new Map<string, string>(), receiptOwners = new Map<string, string>();
    const capability: Available = Object.freeze({ status: 'available', platform: original.platform,
      retire: async value => {
        const request = captureRequest(value); if (!request) throw TypeError('invalid_original_sheet_retirement_request');
        const known = requests.get(request.presentationTicket);
        if (known && !same(known.request, request) || retirementOwners.has(request.retirementTicket) && retirementOwners.get(request.retirementTicket) !== request.presentationTicket) throw TypeError('foreign_original_sheet_retirement_request');
        if (known?.receipt) return known.receipt;
        const entry = known ?? { request, receipt: null };
        requests.set(request.presentationTicket, entry); retirementOwners.set(request.retirementTicket, request.presentationTicket);
        // Keep the ORIGINAL function and module even when bridge delivery overlaps a reload/prop mutation.
        const raw = await retire.call(native, request.presentationTicket, request.parentTicket, request.retirementTicket);
        const receipt = captureReceipt(raw, original.platform, entry.request);
        if (!receipt) throw TypeError('invalid_original_sheet_retirement_receipt');
        if (entry.receipt) {
          if (entry.receipt.receiptID !== receipt.receiptID || entry.receipt.disposition !== receipt.disposition) throw TypeError('retargeted_original_sheet_retirement_receipt');
          return entry.receipt;
        }
        const owner = receiptOwners.get(receipt.receiptID);
        if (owner !== undefined && owner !== request.presentationTicket) throw TypeError('foreign_original_sheet_retirement_receipt');
        receiptOwners.set(receipt.receiptID, request.presentationTicket); entry.receipt = receipt;
        receipts.set(receipt, Object.freeze({ capability, request: entry.request })); return receipt;
      } });
    issued.add(capability); return capability;
  } catch { return unavailable; }
}
/** Availability of the implemented cleanup protocol only. No presentation readiness, Source acceptance or child-absence proof. */
export function readAdminOwnedSheetRetirementCapability(showCapability: unknown): Promise<AdminOwnedSheetRetirementCapability> {
  const original = adminOwnedSheetOriginalModule(showCapability); if (!original || !object(showCapability)) return Promise.resolve(unavailable);
  let pending = cache.get(showCapability);
  if (!pending) { pending = bind(original); cache.set(showCapability, pending); }
  return pending;
}
export function isAdminOwnedSheetRetirementCapability(value: unknown): value is Available { return object(value) && issued.has(value); }
/** Receipt identity is specific to its actual original module binding and request. A spread/JSON copy proves no cleanup. */
export function isAdminOwnedSheetRetirementReceipt(capability: unknown, value: unknown, original: AdminOwnedSheetRetirementRequest): value is AdminOwnedSheetRetirementReceipt {
  if (!isAdminOwnedSheetRetirementCapability(capability) || !object(value)) return false;
  const owner = receipts.get(value), request = captureRequest(original);
  return !!owner && owner.capability === capability && request !== null && same(owner.request, request);
}
