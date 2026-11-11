import { MobileApiException } from './shared/mobileApiException';

const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object'
  ? value as Record<string, unknown> : {};

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

export function workerQueueReadError(statusCode: number, payload: unknown, resource = 'queue'): MobileApiException {
  const value = object(payload);
  const code = typeof value.error === 'string' && value.error.trim() ? value.error.trim()
    : statusCode === 401 ? 'unauthorized' : statusCode === 403 ? 'forbidden' : resource === 'profile' ? 'profile_failed' : 'production_map_sequence';
  const message = statusCode === 401 ? 'Sessiya tugagan. Qayta kiring.'
    : statusCode === 403 ? resource === 'profile' ? 'Profilni yangilab bo‘lmadi.'
      : 'Server bu hisobga aparat navbatini ko‘rishga ruxsat bermadi. Hisob ruxsatlari va aparat biriktirilishini tekshiring.'
    : `Server xatosi (${statusCode})`;
  return new MobileApiException({ code, statusCode, message, diagnostics: value });
}

export function workerQueueContractError(detail: string): MobileApiException {
  return new MobileApiException({ code: 'production_map_snapshot_contract_invalid', message: `Production map navbati server shartnomasiga mos emas: ${detail}` });
}
