import { MobileApiException } from '../shared/mobileApiException';
import { dartTrim } from './dartJsonString';

/** A Source exception category established by the actual transport/decoder boundary, never by a message or constructor-name guess. */
export type AdminProgressQrFailureKind = 'timeout' | 'http-client' | 'format' | 'type' | null;
export function adminProgressQrKnownFailureKind(error: unknown): AdminProgressQrFailureKind {
  return error instanceof TypeError ? 'type' : error instanceof SyntaxError ? 'format' : null;
}
/** @v2 _shouldTryPaddonLookup; only five ASCII digits after Dart trim. */
export const adminProgressQrMayTryPaddon = (qrPayload: string): boolean => /^[0-9]{5}$/.test(dartTrim(qrPayload));
/** @v2 _shouldTryOpeningWipLookup and _shouldTryRawMaterialLookup; type and exact code are both material. */
export const adminProgressQrMayTryOpeningOrMaterial = (error: unknown): boolean => error instanceof MobileApiException &&
  (error.code === 'progress_batch_not_found' || error.code === 'progress_batch_not_accepted');
/** @v2 _preferFallbackLookupError; once lookupError ceases eligible, later fallback failures cannot replace it. */
export function adminProgressQrPreferFallbackError(current: unknown, fallback: unknown, kind: AdminProgressQrFailureKind): unknown {
  if (!adminProgressQrMayTryOpeningOrMaterial(current)) return current;
  if (kind === 'timeout' || kind === 'http-client' || kind === 'format' || kind === 'type') return fallback;
  return fallback instanceof MobileApiException && (fallback.statusCode === 401 || fallback.statusCode === 403 || (fallback.statusCode ?? 0) >= 500 ||
    fallback.code === 'unauthorized' || fallback.code === 'forbidden') ? fallback : current;
}
export type AdminProgressQrFallbackState = Readonly<{
  primaryError: unknown; lookupError: unknown; tryPaddon: boolean; tryOpeningWip: boolean; tryMaterial: boolean;
}>;
/** Source Opening/Raw eligibility always reads the ORIGINAL primary error, while display-error preference evolves separately. */
export function adminProgressQrFallbackState(qrPayload: string, primaryError: unknown): AdminProgressQrFallbackState {
  const eligible = adminProgressQrMayTryOpeningOrMaterial(primaryError);
  return Object.freeze({ primaryError, lookupError: primaryError, tryPaddon: adminProgressQrMayTryPaddon(qrPayload), tryOpeningWip: eligible, tryMaterial: eligible });
}
export function adminProgressQrFallbackFailed(state: AdminProgressQrFallbackState, error: unknown, kind: AdminProgressQrFailureKind): AdminProgressQrFallbackState {
  return Object.freeze({ ...state, lookupError: adminProgressQrPreferFallbackError(state.lookupError, error, kind) });
}
