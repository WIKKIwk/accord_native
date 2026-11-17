import { useEffect, useRef, useState } from 'react';
import { MobileApiException } from '../shared/mobileApiException';
import type { ArchivePrintEntry } from './gscaleArchive';
import type { GScaleOperatorStore } from './gscaleOperatorState';

/** @v2 archiveReceiptReprintErrorMessage */
export function materialArchiveReceiptError(error: unknown) {
  if (error instanceof MobileApiException) return error.message;
  const message = (error instanceof Error ? error.message : String(error)).trim();
  return message.replace('Bad state: ', '').replace('Exception: ', '');
}

/** @v2 _RpsQrReprintSheetState._reprint, bound to the original Material account. */
export function useMaterialArchiveReceipt(entry: ArchivePrintEntry, operator: GScaleOperatorStore, isCurrent: () => boolean) {
  const [printing, setPrinting] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState('');
  const mounted = useRef(true), busy = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => { if (mounted.current) setSuccess(''); }, 4000);
    return () => clearTimeout(timer);
  }, [success]);
  const reprint = async () => {
    if (busy.current || !mounted.current || !isCurrent()) return;
    busy.current = true; setPrinting(true); setError(''); setSuccess('');
    try {
      const warning = await operator.reprintArchiveReceipt(entry);
      if (!mounted.current || !isCurrent()) return;
      setError(warning?.trim() ? warning : ''); setSuccess('Mavjud QR qayta chop etildi');
    } catch (reason) {
      if (mounted.current && isCurrent()) setError(materialArchiveReceiptError(reason));
    } finally {
      busy.current = false;
      if (mounted.current && isCurrent()) setPrinting(false);
    }
  };
  return { printing, error, success, reprint };
}
