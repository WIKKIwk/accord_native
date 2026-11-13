import { useEffect, useRef, useState } from 'react';
import { captureSessionWitness, isSessionWitnessCurrent, subscribeSessionWitness,
  type Session, type SessionWitness } from '../auth';
import { rawMaterialBarcodeFromQr } from '../shared/barcode/rawMaterialBarcode';
import { MobileApiException } from '../shared/mobileApiException';
import { MetalayzerFormatError, MetalayzerStateError, metalayzerComplete, metalayzerMaterial, metalayzerScope,
  type MetalayzerMaterial } from './metalayzerApi';
import { useMetalayzerContext } from './MetalayzerContext';

export { formatMetalayzerQuantity } from './metalayzerApi';
type Operation = { id: number; session: Session; witness: SessionWitness };
const message = (error: unknown): string => error instanceof MobileApiException ? error.message
  : error instanceof MetalayzerFormatError ? 'Xomashyo ma’lumotlari tasdiqlanmadi. Qayta tekshiring.'
  : error instanceof MetalayzerStateError ? 'Akkaunt yoki ruxsatlar o‘zgardi. Sahifani qayta oching.'
  : 'Serverga ulanib bo‘lmadi. Internet aloqasini tekshirib, qayta urinib ko‘ring.';

/** @v2 MetalayzerScreen */
export function useMetalayzerLogic() {
  const owner = useMetalayzerContext(), session = owner.session;
  let allowed = false;
  try { metalayzerScope(session); allowed = owner.isCurrent() && !!captureSessionWitness(session); } catch { /* No Metalayzer access. */ }
  const [barcode, setBarcodeValue] = useState(''), [material, setMaterial] = useState<MetalayzerMaterial | null>(null);
  const [inputError, setInputError] = useState<string | null>(null), [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false), [saving, setSaving] = useState(false);
  const operationId = useRef(0), active = useRef(false), mounted = useRef(false), scan = useRef<Operation | null>(null);
  useEffect(() => {
    mounted.current = true;
    const operation = operationId;
    const unsubscribe = subscribeSessionWitness(() => {
      operation.current++; scan.current = null; active.current = false;
      setBarcodeValue(''); setMaterial(null); setInputError(null); setError(null); setBusy(false); setSaving(false);
    });
    return () => { mounted.current = false; operation.current++; unsubscribe(); };
  }, []);
  const isCurrent = (op: Operation) => mounted.current && owner.isCurrent() && operationId.current === op.id && isSessionWitnessCurrent(op.witness);
  const begin = (): Operation | null => {
    if (active.current || !allowed || !session) return null;
    const witness = captureSessionWitness(session);
    if (!witness) return null;
    active.current = true; const op = { id: ++operationId.current, session, witness };
    setBusy(true); setError(null); setInputError(null); return op;
  };
  const finish = (op: Operation) => {
    if (!isCurrent(op)) return;
    active.current = false; setBusy(false); setSaving(false);
  };
  const performLookup = async (op: Operation, raw: string) => {
    try {
      const code = rawMaterialBarcodeFromQr(raw);
      if (!code) { if (isCurrent(op)) setInputError('Xomashyo QR kodini kiriting'); return; }
      if (!isCurrent(op)) return;
      setBarcodeValue(code); setMaterial(null);
      const result = await metalayzerMaterial(op.session, code, op.witness);
      if (isCurrent(op)) setMaterial(result);
    } catch (reason) { if (isCurrent(op)) setError(message(reason)); }
    finally { finish(op); }
  };
  const lookup = () => { const op = begin(); if (op) void performLookup(op, barcode); };
  const startScan = (): boolean => {
    const op = begin(); if (!op) return false;
    scan.current = op; return true;
  };
  const lookupScanned = (value: string | null) => {
    const op = scan.current; scan.current = null;
    if (!op || !isCurrent(op)) return;
    if (value === null) { finish(op); return; }
    void performLookup(op, value);
  };
  const complete = () => {
    if (!material || material.isMetalayzer) return;
    const op = begin(); if (!op) return;
    setSaving(true);
    void (async () => {
      try {
        const result = await metalayzerComplete(op.session, material.barcode, op.witness);
        if (isCurrent(op)) setMaterial(result);
      } catch (reason) { if (isCurrent(op)) setError(message(reason)); }
      finally { finish(op); }
    })();
  };
  const setBarcode = (value: string) => { setBarcodeValue(value); setMaterial(null); setInputError(null); setError(null); };
  return { barcode, setBarcode, material, inputError, error: error ?? (allowed ? null : 'Metalayzer akkaunti bilan kiring.'),
    busy, saving, enabled: !busy && allowed, lookup, startScan, lookupScanned, complete };
}
