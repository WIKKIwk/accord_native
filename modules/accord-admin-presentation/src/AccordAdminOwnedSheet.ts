import { requireNativeView, requireOptionalNativeModule } from 'expo';
import type { ComponentType, ReactElement } from 'react';
import type { NativeSyntheticEvent, StyleProp, ViewStyle } from 'react-native';

export type AdminOwnedSheetPlatform = 'android' | 'ios';
export type AdminOwnedSheetConfiguration = Readonly<{
  presentationTicket: string; parentTicket: string; parentViewTag: number; parentNativeID: string;
  heightPoints: number; cornerRadius: number;
  /** Required Source dim amount on Android. UIKit owns native iOS sheet dimming. */
  barrierOpacity?: number;
}>;
export type AdminOwnedSheetAcceptedClose = Readonly<{ presentationTicket: string; closeTicket: string; transaction: string | null }>;
export type AdminOwnedSheetNativeProps = Readonly<{
  configuration: AdminOwnedSheetConfiguration; layoutRoot: true; dismissalEnabled: boolean;
  acceptedClose: AdminOwnedSheetAcceptedClose | null;
  onSheetEvent: (event: NativeSyntheticEvent<unknown>) => void;
  /** Exactly one actual React root, retained in its original native portal. */
  children: ReactElement; style?: StyleProp<ViewStyle>;
}>;
export type AdminOwnedSheetCapability = Readonly<{ status: 'unavailable' }> | Readonly<{
  status: 'available'; platform: AdminOwnedSheetPlatform; NativeView: ComponentType<AdminOwnedSheetNativeProps>;
}>;
const unavailable: AdminOwnedSheetCapability = Object.freeze({ status: 'unavailable' });
const issued = new WeakSet<object>();
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const ticket = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9:._-]{0,159}$/.exec(value)?.[0] === value;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const guarantee = { ios: 'owned-uikit-presentation-and-dismissal', android: 'owned-android-presentation-and-dismissal' } as const;

/** Module/view availability only. This supplies no authentication, Source acceptance, window readiness or cleanup receipt. */
export async function readAdminOwnedSheetCapability(platform: string): Promise<AdminOwnedSheetCapability> {
  if (platform !== 'android' && platform !== 'ios') return unavailable;
  try {
    const native = requireOptionalNativeModule<{ sheetCapability?: () => Promise<unknown> }>('AccordAdminPresentation');
    const read = native?.sheetCapability;
    if (!native || typeof read !== 'function') return unavailable;
    const value = await read.call(native);
    if (!object(value) || value.protocol !== 1 || value.platform !== platform || value.guarantee !== guarantee[platform] || value.viewName !== 'AdminSheetPortal') return unavailable;
    const NativeView = requireNativeView<AdminOwnedSheetNativeProps>('AccordAdminPresentation', 'AdminSheetPortal');
    if (typeof NativeView !== 'function') return unavailable;
    const result = Object.freeze({ status: 'available' as const, platform, NativeView }); issued.add(result); return result;
  } catch { return unavailable; }
}
/** Reject copied/foreign capability DTOs. Even a genuine module capability never means a native sheet is shown. */
export function isAdminOwnedSheetCapability(value: unknown): value is Extract<AdminOwnedSheetCapability, { status: 'available' }> {
  return object(value) && issued.has(value);
}

/** Capture the exact original native configuration before mounting. Unknown Source geometry stays unavailable. */
export function captureAdminOwnedSheetConfiguration(platform: AdminOwnedSheetPlatform, input: unknown): AdminOwnedSheetConfiguration | null {
  try {
    if (!['android', 'ios'].includes(platform) || !object(input)) return null;
    const { presentationTicket, parentTicket, parentViewTag, parentNativeID, heightPoints, cornerRadius, barrierOpacity } = input;
    if (!ticket(presentationTicket) || !ticket(parentTicket) || presentationTicket === parentTicket || !ticket(parentNativeID) ||
      typeof parentViewTag !== 'number' || !Number.isSafeInteger(parentViewTag) || parentViewTag <= 0 || parentViewTag > 0x7fffffff ||
      !finite(heightPoints) || heightPoints <= 0 || !finite(cornerRadius) || cornerRadius < 0 ||
      platform === 'android' && (!finite(barrierOpacity) || barrierOpacity < 0 || barrierOpacity > 1)) return null;
    return Object.freeze({ presentationTicket, parentTicket, parentViewTag, parentNativeID, heightPoints, cornerRadius,
      ...(platform === 'android' ? { barrierOpacity: barrierOpacity as number } : {}) });
  } catch { return null; }
}

/** Captures an intent only; the caller must separately prove original Source acceptance/account lifetime.
 * Null transaction is an independent accepted intent: native atomically binds its OWN same-presentation transaction.
 */
export function captureAdminOwnedSheetAcceptedClose(original: AdminOwnedSheetConfiguration, input: unknown): AdminOwnedSheetAcceptedClose | null {
  try {
    if (!object(original) || !object(input)) return null;
    const { presentationTicket, closeTicket, transaction } = input;
    if (!ticket(original.presentationTicket) || !ticket(original.parentTicket) || presentationTicket !== original.presentationTicket ||
      !ticket(closeTicket) || transaction !== null && !ticket(transaction)) return null;
    const identities = [presentationTicket, original.parentTicket, closeTicket, ...(transaction === null ? [] : [transaction])];
    return new Set(identities).size === identities.length ? Object.freeze({ presentationTicket, closeTicket, transaction }) : null;
  } catch { return null; }
}

export type AdminOwnedSheetEventKind = 'shown' | 'attempt' | 'willDismiss' | 'cancelled' | 'didDismiss' | 'closeAccepted' | 'closeJoined' | 'failed' | 'retired' | 'layout';
export type AdminOwnedSheetEvent = Readonly<{
  protocol: 1; kind: AdminOwnedSheetEventKind; sequence: number; presentationTicket: string; parentTicket: string;
  transaction: string | null; acceptedClose: string | null; reason: string | null;
  layout: Readonly<{ width: number; height: number }> | null;
}>;
const kinds = new Set<AdminOwnedSheetEventKind>(['shown', 'attempt', 'willDismiss', 'cancelled', 'didDismiss', 'closeAccepted', 'closeJoined', 'failed', 'retired', 'layout']);
/** Wire validation only. A parsed native fact does not accept a Source cancel, pop a route or certify cleanup. */
export function parseAdminOwnedSheetEvent(input: unknown, original: Pick<AdminOwnedSheetConfiguration, 'presentationTicket' | 'parentTicket'>): AdminOwnedSheetEvent | null {
  try {
    if (!object(input) || !object(original)) return null;
    const { presentationTicket: expectedPresentation, parentTicket: expectedParent } = original;
    const { protocol, kind, sequence, presentationTicket, parentTicket, transaction: rawTransaction, acceptedClose: rawClose, reason: rawReason, width, height } = input;
    const transaction = rawTransaction ?? null, acceptedClose = rawClose ?? null, reason = rawReason ?? null;
    if (!ticket(expectedPresentation) || !ticket(expectedParent) || expectedPresentation === expectedParent || protocol !== 1 ||
      typeof kind !== 'string' || !kinds.has(kind as AdminOwnedSheetEventKind) || typeof sequence !== 'number' || !Number.isSafeInteger(sequence) || sequence <= 0 ||
      presentationTicket !== expectedPresentation || parentTicket !== expectedParent || transaction !== null && !ticket(transaction) ||
      acceptedClose !== null && !ticket(acceptedClose) || reason !== null && (typeof reason !== 'string' || reason.length === 0)) return null;
    const identities = [presentationTicket, parentTicket, ...(transaction === null ? [] : [transaction]), ...(acceptedClose === null ? [] : [acceptedClose])];
    if (new Set(identities).size !== identities.length) return null;
    if (['willDismiss', 'cancelled', 'didDismiss', 'closeAccepted', 'closeJoined'].includes(kind) && transaction === null ||
      ['closeAccepted', 'closeJoined'].includes(kind) && acceptedClose === null ||
      ['attempt', 'willDismiss', 'cancelled'].includes(kind) && acceptedClose !== null ||
      kind === 'attempt' && transaction !== null ||
      kind === 'failed' && reason === null || kind !== 'failed' && reason !== null ||
      acceptedClose !== null && transaction === null) return null;
    const layout = kind === 'layout' && finite(width) && width > 0 && finite(height) && height > 0 ? Object.freeze({ width, height }) : null;
    if (kind === 'layout' && layout === null) return null;
    return Object.freeze({ protocol: 1, kind: kind as AdminOwnedSheetEventKind, sequence, presentationTicket, parentTicket, transaction, acceptedClose, reason, layout });
  } catch { return null; }
}
