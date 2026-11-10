/** @v2 _AdminProgressQrScanScreenState._extractQrPayload */
export function workerQrPayload(raw: string): string {
  const value = raw.trim();
  if (!value) return '';
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return value;
    // Dart Uri.pathSegments ignores the initial slash and preserves a trailing
    // empty segment. Query precedence is null-coalescing, not first-nonempty.
    const segments = url.pathname === '/' ? [] : url.pathname.replace(/^\//, '').split('/');
    if (!segments.length) return value;
    const query = (url.searchParams.get('qr_payload') ?? url.searchParams.get('progress_qr') ?? url.searchParams.get('epc') ?? '').trim();
    return query || decodeURIComponent(segments[segments.length - 1]).trim();
  } catch { return value; }
}

/** One initial scan per sheet; it validates input without issuing a queue action. */
export class WorkerInitialQr {
  private consumed = false;
  constructor(readonly value: string) {}
  run(synchronized: boolean, validate: (qr: string) => void) {
    const qr = workerQrPayload(this.value);
    if (!qr || !synchronized || this.consumed) return;
    this.consumed = true;
    validate(qr);
  }
}
