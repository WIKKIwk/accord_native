import { MobileApiException } from './shared/mobileApiException';
import { productionMapResponseError, productionMapUnknownErrorMessage } from './workerControlsApi';

const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object'
  ? value as Record<string, unknown> : {};
const jsonText = (value: unknown): string => Array.isArray(value) ? `[${value.map(jsonText).join(', ')}]`
  : value !== null && typeof value === 'object' ? `{${Object.entries(value).map(([key, item]) => `${key}: ${jsonText(item)}`).join(', ')}}` : String(value);

/** @v2 _canRetryWorkerRead */
export function workerQueueReadCanRetry(error: unknown): boolean {
  const value = object(error);
  return value.statusCode !== 401 && value.statusCode !== 403 &&
    !['unauthorized', 'forbidden', 'production_map_snapshot_contract_invalid'].includes(String(value.code ?? ''));
}

/** @v2 _discardCanonicalCacheOnError */
export function workerQueueReadAuthorizationError(error: unknown): boolean {
  const value = object(error);
  return value.statusCode === 401 || value.statusCode === 403 ||
    ['unauthorized', 'forbidden', 'permission_denied', 'production_map_snapshot_contract_invalid'].includes(String(value.code ?? ''));
}

export function workerQueueReadError(statusCode: number, payload: unknown, resource = 'queue', headers?: Pick<Headers, 'get'>): Error {
  // profile() is not a production-map API and uses a plain source exception.
  if (resource === 'profile') return new Error('Profile fetch failed');
  const value = object(payload);
  if (resource === 'live') {
    const code = value.error == null ? '' : jsonText(value.error).replace(/^[\s\u0085]+|[\s\u0085]+$/g, '');
    return new MobileApiException({ code: code || 'production_map_live_failed',
      message: productionMapUnknownErrorMessage(code, 'production_map_live_failed', 0) });
  }
  const mapped = productionMapResponseError(statusCode, payload,
    resource === 'live-http' ? 'production_map_live_failed' : 'production_map_sequence', headers);
  return new MobileApiException({ code: mapped.code, message: mapped.message, statusCode: mapped.statusCode,
    diagnostics: mapped.diagnostics, requestId: mapped.requestId, apparatusOptions: mapped.apparatusOptions,
    details: mapped.details, activeKadrCount: mapped.activeKadrCount, scannedKadrCount: mapped.scannedKadrCount,
    orderTitle: mapped.orderTitle });
}

export function workerQueueContractError(detail: string): MobileApiException {
  return new MobileApiException({ code: 'production_map_snapshot_contract_invalid', message: `Production map navbati server shartnomasiga mos emas: ${detail}` });
}
