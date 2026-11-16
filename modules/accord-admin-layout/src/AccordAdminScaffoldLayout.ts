import { NativeModule, requireOptionalNativeModule } from 'expo';

export const adminScaffoldLayoutProtocol = 1 as const;
export const adminScaffoldLayoutGuarantee = 'original-window-layout-snapshot' as const;
export type AdminScaffoldMarker = Readonly<{ tag: number; nativeID: string }>;
export type AdminScaffoldRect = Readonly<{ x: number; y: number; width: number; height: number }>;
export type AdminScaffoldViewport = Readonly<{
  rect: AdminScaffoldRect; rawImeBottom: number; viewPaddingBottom: number; systemGestureBottom: number; safeTop: number; safeLeft: number; safeRight: number;
}>;
export type AdminScaffoldPair = Readonly<{ viewport: AdminScaffoldViewport; fixed: AdminScaffoldRect; dockHeight: number }>;
export type AdminScaffoldDock = Readonly<{ viewport: AdminScaffoldViewport; dockHeight: number }>;
export type AdminScaffoldLayoutEvent = Readonly<{
  protocol: 1; guarantee: typeof adminScaffoldLayoutGuarantee; platform: 'android' | 'ios'; kind: 'viewport' | 'dock' | 'pair';
  handle: string; ticket: string; windowID: string; viewportHandle: string; revision: number; frame: number; retired: boolean;
  viewport: AdminScaffoldViewport | null; dock: AdminScaffoldDock | null; pair: AdminScaffoldPair | null;
}>;
export type AdminScaffoldLayoutReceipt = Readonly<{ handle: string; ticket: string; windowID: string; initial: AdminScaffoldLayoutEvent }>;
export type AdminScaffoldLayoutCapability = Readonly<{ protocol: 1; guarantee: typeof adminScaffoldLayoutGuarantee; platform: 'android' | 'ios'; rawIme: true }>;
export type AdminScaffoldLayoutObserver = Readonly<{
  capability: AdminScaffoldLayoutCapability;
  bindViewport: (marker: AdminScaffoldMarker, ticket: string) => Promise<AdminScaffoldLayoutReceipt>;
  bindDock: (viewport: AdminScaffoldLayoutReceipt, dock: AdminScaffoldMarker, ticket: string) => Promise<AdminScaffoldLayoutReceipt>;
  bindParts: (viewport: AdminScaffoldLayoutReceipt, dock: AdminScaffoldMarker, fixed: AdminScaffoldMarker, ticket: string) => Promise<AdminScaffoldLayoutReceipt>;
  release: (receipt: AdminScaffoldLayoutReceipt) => Promise<boolean>;
  cancelTicket: (ticket: string) => Promise<boolean>;
  subscribe: (listener: (event: AdminScaffoldLayoutEvent) => void) => () => void;
}>;
declare class NativeScaffoldLayout extends NativeModule<{ onScaffoldLayoutChange: (event: unknown) => void }> {
  scaffoldLayoutCapability(): Promise<unknown>;
  bindScaffoldViewport(tag: number, nativeID: string, ticket: string): Promise<unknown>;
  bindScaffoldDock(handle: string, viewportTicket: string, tag: number, nativeID: string, ticket: string): Promise<unknown>;
  bindScaffoldParts(handle: string, viewportTicket: string, dockTag: number, dockID: string, fixedTag: number, fixedID: string, ticket: string): Promise<unknown>;
  releaseScaffoldLayout(handle: string, ticket: string): Promise<unknown>;
  cancelScaffoldLayoutTicket(ticket: string): Promise<unknown>;
}
const id = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9:._-]{0,159}$/.exec(value)?.[0] === value;
const row = (value: unknown): Record<string, unknown> => { if (!value || typeof value !== 'object' || Array.isArray(value)) throw TypeError('Invalid scaffold layout receipt'); return value as Record<string, unknown>; };
const scalar = (value: unknown, positive = false): number => { if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || positive && value === 0) throw TypeError('Invalid scaffold layout measurement'); return value; };
function rect(value: unknown): AdminScaffoldRect {
  const item = row(value); if (typeof item.x !== 'number' || !Number.isFinite(item.x) || typeof item.y !== 'number' || !Number.isFinite(item.y)) throw TypeError('Invalid scaffold layout origin');
  return Object.freeze({ x: item.x, y: item.y, width: scalar(item.width, true), height: scalar(item.height, true) });
}
function viewport(value: unknown): AdminScaffoldViewport {
  const item = row(value), bounds = rect(item.rect), safeLeft = scalar(item.safeLeft), safeRight = scalar(item.safeRight);
  if (safeLeft + safeRight >= bounds.width) throw TypeError('Invalid scaffold SafeArea');
  return Object.freeze({ rect: bounds, rawImeBottom: scalar(item.rawImeBottom), viewPaddingBottom: scalar(item.viewPaddingBottom),
    systemGestureBottom: scalar(item.systemGestureBottom), safeTop: scalar(item.safeTop), safeLeft, safeRight });
}
function pair(value: unknown): AdminScaffoldPair {
  const item = row(value); return Object.freeze({ viewport: viewport(item.viewport), fixed: rect(item.fixed), dockHeight: scalar(item.dockHeight, true) });
}
function dock(value: unknown): AdminScaffoldDock { const item = row(value); return Object.freeze({ viewport: viewport(item.viewport), dockHeight: scalar(item.dockHeight, true) }); }
export function adminScaffoldLayoutEvent(value: unknown, platform: string): AdminScaffoldLayoutEvent {
  const item = row(value);
  if (item.protocol !== adminScaffoldLayoutProtocol || item.guarantee !== adminScaffoldLayoutGuarantee || item.platform !== platform || !['android', 'ios'].includes(platform) ||
    !['viewport', 'dock', 'pair'].includes(item.kind as string) || ![item.handle, item.ticket, item.windowID, item.viewportHandle].every(id) ||
    typeof item.revision !== 'number' || !Number.isSafeInteger(item.revision) || item.revision <= 0 || typeof item.frame !== 'number' || !Number.isSafeInteger(item.frame) || item.frame <= 0 || typeof item.retired !== 'boolean') throw TypeError('Invalid original scaffold layout event');
  if (item.viewport !== null && item.kind !== 'viewport' || item.pair !== null && item.kind !== 'pair' || item.dock !== null && item.kind !== 'dock' || item.retired && (item.viewport !== null || item.pair !== null || item.dock !== null) ||
    item.kind === 'viewport' && item.viewportHandle !== item.handle) throw TypeError('Invalid scaffold layout event kind');
  return Object.freeze({ protocol: 1, guarantee: adminScaffoldLayoutGuarantee, platform: platform as 'android' | 'ios', kind: item.kind as 'viewport' | 'dock' | 'pair',
    handle: item.handle as string, ticket: item.ticket as string, windowID: item.windowID as string, viewportHandle: item.viewportHandle as string, revision: item.revision, frame: item.frame, retired: item.retired,
    viewport: item.viewport === null ? null : viewport(item.viewport), dock: item.dock === null ? null : dock(item.dock), pair: item.pair === null ? null : pair(item.pair) });
}
function receipt(value: unknown, platform: string, ticket: string, kind: 'viewport' | 'dock' | 'pair'): AdminScaffoldLayoutReceipt {
  const item = row(value), initial = adminScaffoldLayoutEvent(item.initial, platform);
  if (![item.handle, item.ticket, item.windowID].every(id) || item.ticket !== ticket || initial.kind !== kind || initial.retired ||
    initial.handle !== item.handle || initial.ticket !== item.ticket || initial.windowID !== item.windowID) throw TypeError('Invalid original scaffold bind receipt');
  return Object.freeze({ handle: item.handle as string, ticket, windowID: item.windowID as string, initial });
}
function marker(value: AdminScaffoldMarker) { if (!value || !Number.isSafeInteger(value.tag) || value.tag <= 0 || value.tag > 0x7fffffff || !id(value.nativeID)) throw TypeError('Actual scaffold marker is required'); }
/** Capability means only that this original-window protocol exists. It does not create a Scaffold or declare a rendered host ready. */
export async function readAdminScaffoldLayoutObserver(platform: string): Promise<AdminScaffoldLayoutObserver | null> {
  if (platform !== 'android' && platform !== 'ios') return null;
  try {
    const native = requireOptionalNativeModule<NativeScaffoldLayout>('AccordAdminLayout');
    if (!native || ['scaffoldLayoutCapability', 'bindScaffoldViewport', 'bindScaffoldDock', 'bindScaffoldParts', 'releaseScaffoldLayout', 'cancelScaffoldLayoutTicket', 'addListener'].some(key => typeof (native as unknown as Record<string, unknown>)[key] !== 'function')) return null;
    const capability = row(await native.scaffoldLayoutCapability());
    if (capability.protocol !== 1 || capability.guarantee !== adminScaffoldLayoutGuarantee || capability.platform !== platform || capability.rawIme !== true) return null;
    const boundCapability: AdminScaffoldLayoutCapability = Object.freeze({ protocol: 1, guarantee: adminScaffoldLayoutGuarantee, platform, rawIme: true });
    const accept = (value: unknown, ticket: string, kind: 'viewport' | 'dock' | 'pair') => {
      try { return receipt(value, platform, ticket, kind); }
      catch (error) {
        try { const raw = row(value); if (id(raw.handle) && raw.ticket === ticket) void native.releaseScaffoldLayout(raw.handle, ticket).catch(() => {}); } catch {}
        throw error;
      }
    };
    return Object.freeze({ capability: boundCapability,
      bindViewport: async (value: AdminScaffoldMarker, ticket: string) => { marker(value); if (!id(ticket)) throw TypeError('Original scaffold ticket required'); return accept(await native.bindScaffoldViewport(value.tag, value.nativeID, ticket), ticket, 'viewport'); },
      bindDock: async (owner: AdminScaffoldLayoutReceipt, value: AdminScaffoldMarker, ticket: string) => {
        marker(value); if (!owner || owner.initial.kind !== 'viewport' || !id(owner.handle) || !id(owner.ticket) || !id(ticket)) throw TypeError('Original viewport receipt required');
        const result = accept(await native.bindScaffoldDock(owner.handle, owner.ticket, value.tag, value.nativeID, ticket), ticket, 'dock');
        if (result.windowID !== owner.windowID || result.initial.viewportHandle !== owner.handle) { void native.releaseScaffoldLayout(result.handle, result.ticket).catch(() => {}); throw TypeError('Cross-window scaffold receipt'); } return result;
      },
      bindParts: async (owner: AdminScaffoldLayoutReceipt, dock: AdminScaffoldMarker, fixed: AdminScaffoldMarker, ticket: string) => {
        marker(dock); marker(fixed); if (!owner || owner.initial.kind !== 'viewport' || !id(owner.handle) || !id(owner.ticket) || !id(ticket)) throw TypeError('Original viewport receipt required');
        const value = accept(await native.bindScaffoldParts(owner.handle, owner.ticket, dock.tag, dock.nativeID, fixed.tag, fixed.nativeID, ticket), ticket, 'pair');
        if (value.windowID !== owner.windowID || value.initial.viewportHandle !== owner.handle) { void native.releaseScaffoldLayout(value.handle, value.ticket).catch(() => {}); throw TypeError('Cross-window scaffold receipt'); } return value;
      },
      release: async (value: AdminScaffoldLayoutReceipt) => { if (!value || !id(value.handle) || !id(value.ticket)) return false; return await native.releaseScaffoldLayout(value.handle, value.ticket) === true; },
      cancelTicket: async (ticket: string) => id(ticket) && await native.cancelScaffoldLayoutTicket(ticket) === true,
      subscribe: (listener: (event: AdminScaffoldLayoutEvent) => void) => { const subscription = native.addListener('onScaffoldLayoutChange', value => { try { listener(adminScaffoldLayoutEvent(value, platform)); } catch { /* An invalid native event never supplies layout or authority. */ } }); return () => subscription.remove(); },
    });
  } catch { return null; }
}
