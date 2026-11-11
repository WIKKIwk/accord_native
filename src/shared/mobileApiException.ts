type Diagnostics = Record<string, unknown>;
export type MobileApiExceptionOptions = {
  code: string; message: string; statusCode?: number | null; apparatusOptions?: readonly string[]; details?: readonly string[];
  activeKadrCount?: number | null; scannedKadrCount?: number | null; orderTitle?: string; requestId?: string | null;
  diagnostics?: Diagnostics;
};

/** @v2 MobileApiException */
export class MobileApiException extends Error {
  readonly code: string;
  readonly statusCode: number | null;
  readonly apparatusOptions: readonly string[];
  readonly details: readonly string[];
  readonly activeKadrCount: number | null;
  readonly scannedKadrCount: number | null;
  readonly orderTitle: string;
  readonly requestId: string | null;
  readonly diagnostics: Diagnostics;
  constructor(options: MobileApiExceptionOptions) {
    super(options.message);
    this.name = 'MobileApiException';
    this.code = options.code; this.statusCode = options.statusCode ?? null;
    this.apparatusOptions = options.apparatusOptions ?? []; this.details = options.details ?? [];
    this.activeKadrCount = options.activeKadrCount ?? null; this.scannedKadrCount = options.scannedKadrCount ?? null;
    this.orderTitle = options.orderTitle ?? ''; this.requestId = options.requestId ?? null;
    this.diagnostics = options.diagnostics ?? {};
  }
  toString(): string { return this.message; }
}
