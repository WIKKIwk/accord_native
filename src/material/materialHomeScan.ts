import { activeSessionToken, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { dartTrim } from '../shared/dartApparatus';

export type MaterialScanResult = Readonly<{ kind: 'ready'; barcode: string }> |
  Readonly<{ kind: 'cancelled' | 'scope_required' | 'invalidated' }>;
export type MaterialHomeScanDependencies = {
  session: Session;
  /** Must reflect the active screen and the current scan interaction. */
  isCurrent: () => boolean;
  /** The caller supplies the existing native scanner, without opening any destination here. */
  scan: () => Promise<string | null>;
  /** Required: an independently reviewed shared f119 QR parser. No fallback parser is installed. */
  barcodeFromQr: (raw: string) => string;
};

/** @v2 _scanRawMaterial, prepared only; this module does not navigate or expose a route. */
export async function prepareMaterialHomeScan(dependencies: MaterialHomeScanDependencies): Promise<MaterialScanResult> {
  // Capture callback references before crossing the scanner's asynchronous boundary.
  const { session, isCurrent, scan, barcodeFromQr } = dependencies;
  if (typeof isCurrent !== 'function' || typeof scan !== 'function' || typeof barcodeFromQr !== 'function') return { kind: 'invalidated' };
  const token = activeSessionToken(session), scope = sessionReadScope(session);
  const allowed = () => session.profile.role === 'material_taminotchi' && sessionReadScope(session) === scope &&
    canOpenRoute(session, appRoutes.adminRawMaterialAssignments);
  const current = () => {
    try {
      return !!token && activeSessionToken(session) === token && allowed() && isSynchronouslyTrue(isCurrent) &&
        activeSessionToken(session) === token && allowed();
    } catch { return false; }
  };
  if (!current()) return { kind: 'invalidated' };
  if (!session.assigned_item_groups?.length) return { kind: 'scope_required' };
  const raw: unknown = await scan();
  if (!current()) return { kind: 'invalidated' };
  if (raw === null || (typeof raw === 'string' && !dartTrim(raw))) return { kind: 'cancelled' };
  if (typeof raw !== 'string') return { kind: 'invalidated' };
  let barcode: unknown;
  // Reuse the shared strict evaluator so an accidentally async parser cannot
  // authorize a result or leave a rejected Promise unobserved.
  const valid = isSynchronouslyTrue(() => {
    barcode = barcodeFromQr(raw);
    return typeof barcode === 'string' ? true : barcode as boolean;
  });
  if (!valid || typeof barcode !== 'string' || !dartTrim(barcode) || !current()) return { kind: 'invalidated' };
  return { kind: 'ready', barcode };
}
