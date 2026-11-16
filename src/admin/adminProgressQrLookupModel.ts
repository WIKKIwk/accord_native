import type { AdminApparatus } from '../apparatusApi';
import { isAuthorizedReadClientFailure, isAuthorizedReadTimeout } from '../authorizedFetch';
import { MobileApiException } from '../shared/mobileApiException';
import type { AdminProgressQrMaterialReport, AdminProgressQrOpeningWipReport, AdminProgressQrPaddonReport } from './adminProgressQrFallbackModel';
import { adminProgressQrKnownFailureKind, type AdminProgressQrFailureKind } from './adminProgressQrFallbackPolicy';
import type { AdminProgressQrReport } from './adminProgressQrReportModel';
import { dartPartialLower, dartTrim } from './dartJsonString';

export type AdminProgressQrLookupStatus = 'prompt' | 'cameraFailed' | 'invalidQr' | 'loading' | 'reportReady' | 'paddonReady' | 'materialReady' | 'openingWipReady' | 'error';
export type AdminProgressQrLookupState = Readonly<{
  valid: boolean; processing: boolean; status: AdminProgressQrLookupStatus; scanError: unknown | null;
  report: AdminProgressQrReport | null; paddonReport: AdminProgressQrPaddonReport | null;
  rawMaterialReport: AdminProgressQrMaterialReport | null; openingWipReport: AdminProgressQrOpeningWipReport | null;
  apparatus: readonly AdminApparatus[];
}>;
export const adminProgressQrLookupInitial = (valid = true): AdminProgressQrLookupState => Object.freeze({ valid, processing: false, status: 'prompt', scanError: null,
  report: null, paddonReport: null, rawMaterialReport: null, openingWipReport: null, apparatus: Object.freeze([]) });
/** Actual Source exception order: a transport policy TypeError is a client failure before it is a decoding TypeError. */
export function adminProgressQrLookupFailureKind(error: unknown): AdminProgressQrFailureKind {
  return isAuthorizedReadTimeout(error) ? 'timeout' : isAuthorizedReadClientFailure(error) ? 'http-client' : adminProgressQrKnownFailureKind(error);
}
export type AdminProgressQrLookupText = (key: string, values?: Readonly<Record<string, string>>) => string;
/** @v2 _errorText
 * The real localization catalog determines whether a production error has a specific message. */
export function adminProgressQrLookupErrorText(error: unknown, text: AdminProgressQrLookupText, productionErrorMessage: (code: string) => string): string {
  const kind = adminProgressQrLookupFailureKind(error);
  if (kind === 'timeout') return text('worker.error.network_timeout');
  if (kind === 'http-client') return text('worker.qr.connection');
  if (kind === 'format' || kind === 'type') return text('worker.qr.invalid_response');
  if (error instanceof MobileApiException) {
    const code = dartPartialLower(dartTrim(error.code)), order = dartTrim(error.orderTitle);
    if (code === 'order_frozen' && order) return text('worker.freeze.named', { order });
    const key: Record<string, string> = { unauthorized: 'worker.qr.session_expired', forbidden: 'worker.qr.forbidden', order_freeze_requested: 'worker.qr.freeze_requested',
      progress_batch_in_use: 'worker.error.wip_in_use', progress_batch_already_used: 'worker.error.wip_used', progress_qr_invalid_response: 'worker.qr.invalid_response',
      progress_qr_validation_missing: 'worker.qr.invalid_response', progress_input_invalid: 'worker.qr.invalid_response', order_not_found: 'worker.qr.order_unavailable', map_not_found: 'worker.qr.order_unavailable' };
    if (Object.hasOwn(key, code)) return text(key[code]);
    if (error.statusCode === 401) return text('worker.qr.session_expired');
    if (error.statusCode === 403) return text('worker.qr.forbidden');
    if ((error.statusCode ?? 0) >= 500) return text('worker.qr.server');
    const specific = productionErrorMessage(code); if (specific) return specific;
  }
  return text('worker.qr.lookup_failed');
}
export function adminProgressQrLookupStatusText(state: AdminProgressQrLookupState, text: AdminProgressQrLookupText, productionErrorMessage: (code: string) => string): string {
  const keys = { prompt: 'worker.scanner.progress_prompt', cameraFailed: 'worker.scanner.camera_failed', invalidQr: 'worker.scanner.invalid_qr', loading: 'worker.scanner.lookup',
    reportReady: 'worker.scanner.report_ready', paddonReady: 'worker.scanner.paddon_ready', materialReady: 'worker.scanner.material_ready', openingWipReady: 'worker.opening_wip.confirmed' };
  return state.status === 'error' ? adminProgressQrLookupErrorText(state.scanError, text, productionErrorMessage) : text(keys[state.status]);
}
/** Source build order deliberately differs from lookup order and retains earlier report fields until Scan Again. */
export const adminProgressQrLookupVisibleReport = (state: AdminProgressQrLookupState): 'paddon' | 'progress' | 'material' | 'opening-wip' | null =>
  state.paddonReport ? 'paddon' : state.report ? 'progress' : state.rawMaterialReport ? 'material' : state.openingWipReport ? 'opening-wip' : null;
